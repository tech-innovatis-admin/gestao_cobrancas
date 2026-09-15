// FASE 3 — import-google-sheets
// Contrato: ver src/integrations/receivables-source/types.ts e docs/fase-3-google-sheets.md.
// Carga inicial: lê as abas ativas de sheet_competence_map, reaproveita o parser de duas linhas
// (previsto/recebido) do preview, resolve projeto/etapa/responsável e insere em receivables por
// ID_COBRANCA. Nunca atualiza um recebível já existente (isso é escopo de synchronize-google-sheets).
import { requireMasterAdmin } from "../_shared/auth.ts";
import { accessToken, json, loadConfig, sheetsGet } from "../_shared/google.ts";
import { computeSourceHash } from "../_shared/hash.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

interface CellRow { values?: { formattedValue?: string }[] }
interface RangeSheet { data?: { rowData?: CellRow[] }[] }

const COL = { tipo: 0, hub: 1, min: 2, inst: 3, fund: 4, nome: 5, plProjeto: 6, plInnovatis: 7,
  status: 8, motivo: 9, acao: 10, responsavel: 11, prazo: 12, arProjeto: 13, arInnovatis: 14, flag: 15, statusCalc: 16, idCobranca: 17 };
const FASES = new Set(["A", "B", "C", "D"]);

function cell(row: CellRow | undefined, idx: number): string {
  return row?.values?.[idx]?.formattedValue?.trim() ?? "";
}
function isBlankRow(row: CellRow | undefined): boolean {
  return !row?.values?.some((v) => v.formattedValue?.trim());
}
function parseBRL(s: string): number | null {
  if (!s) return null;
  const n = Number(s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
// "Prazo" chega da planilha tipicamente como DD/MM/AAAA (formatação de data do Sheets). Qualquer
// coisa fora desse padrão vira null em vez de derrubar a linha inteira.
function parseDate(s: string): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const day = Number(d), month = Number(mo), year = Number(y);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
// Equivalente TS de public.normalize_text(): minúsculas, sem acentos, espaços colapsados.
function normalizeText(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

Deno.serve(async (req) => {
  try { await requireMasterAdmin(req); } catch (e) { return json({ error: (e as Error).message }, 401); }
  const cfg = loadConfig();
  if ("missing" in cfg) return json({ error: `Configuração pendente: secrets ausentes (${cfg.missing.join(", ")})` }, 503);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: sheetsMap, error: mapErr } = await admin
    .from("sheet_competence_map").select("sheet_name, competence_month, competence_year").eq("active", true);
  if (mapErr) return json({ error: mapErr.message }, 500);
  if (!sheetsMap?.length) return json({ error: "Nenhuma aba ativa em sheet_competence_map." }, 503);

  const { data: legacyRows } = await admin.from("legacy_code_mapping").select("legacy_code, mapped_to, target_value");
  const legacyMap = new Map((legacyRows ?? []).filter((r) => r.mapped_to).map((r) => [r.legacy_code, r]));

  const { data: stageRows } = await admin.from("project_stage_catalog").select("id, code").eq("active", true);
  const stageByCode = new Map((stageRows ?? []).map((r) => [r.code, r.id as string]));

  const { data: statusRows } = await admin.from("collection_status_catalog")
    .select("id, hub, source_label, is_paid, is_partially_paid, is_not_applicable");
  const statusByKey = new Map((statusRows ?? []).map((r) => [`${r.hub}::${normalizeText(r.source_label)}`, r]));

  const { data: profileRows } = await admin.from("profiles").select("user_id, full_name, legacy_responsible_name");
  const profileByName = new Map<string, string>();
  for (const p of profileRows ?? []) {
    if (p.legacy_responsible_name) profileByName.set(normalizeText(p.legacy_responsible_name), p.user_id);
    if (p.full_name) profileByName.set(normalizeText(p.full_name), p.user_id);
  }

  const { data: runRow, error: runErr } = await admin.from("sync_runs")
    .insert({ type: "import", status: "running" }).select("id").single();
  if (runErr || !runRow) return json({ error: runErr?.message ?? "Falha ao registrar sync_runs." }, 500);
  const runId = runRow.id as string;

  const token = await accessToken(cfg, "https://www.googleapis.com/auth/spreadsheets.readonly");

  const stats = { read: 0, created: 0, updated: 0, ignored: 0, errors: 0, conflicts: 0 };
  const issues: string[] = [];
  // Cache de projetos resolvidos nesta execução, por hub::nome-normalizado.
  const projectCache = new Map<string, { id: string; project_stage_id: string | null }>();
  const seenIds = new Set<string>();

  for (const sm of sheetsMap) {
    const competence = `${sm.competence_year}-${String(sm.competence_month).padStart(2, "0")}-01`;

    let sheet: RangeSheet | undefined;
    try {
      const range = `?ranges=${encodeURIComponent(`'${sm.sheet_name}'!A1:R2000`)}&fields=${encodeURIComponent("sheets(data.rowData.values(formattedValue))")}&includeGridData=true`;
      const res = await sheetsGet<{ sheets?: RangeSheet[] }>(cfg, token, range);
      sheet = res.sheets?.[0];
    } catch (e) {
      issues.push(`Aba "${sm.sheet_name}": falha ao ler (${(e as Error).message}).`);
      continue;
    }
    const rows = sheet?.data?.[0]?.rowData ?? [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (isBlankRow(row)) continue;
      const tipo = cell(row, COL.tipo);
      if (!tipo) {
        if (cell(row, COL.fund).toUpperCase().startsWith("TOTAL")) break;
        continue;
      }

      const topRowNumber = i + 1; // 1-based, para mensagens e source_top_row
      let receivedRow: CellRow | undefined;
      let receivedRowNumber: number | null = null;
      const next = rows[i + 1];
      if (next && !isBlankRow(next) && !cell(next, COL.tipo) && !cell(next, COL.fund).toUpperCase().startsWith("TOTAL")) {
        receivedRow = next;
        receivedRowNumber = i + 2; // 1-based
        i++; // consome a linha de recebido
      }

      stats.read++;

      const idCobranca = cell(row, COL.idCobranca);
      if (!idCobranca) {
        stats.errors++;
        issues.push(`Aba "${sm.sheet_name}", linha ${topRowNumber}: sem ID_COBRANCA — rode initialize-google-sheets antes.`);
        continue;
      }
      if (seenIds.has(idCobranca)) {
        stats.ignored++;
        issues.push(`Aba "${sm.sheet_name}", linha ${topRowNumber}: ID_COBRANCA duplicado (${idCobranca}) — ignorado.`);
        continue;
      }
      seenIds.add(idCobranca);

      try {
        const { data: existing, error: existingErr } = await admin.from("receivables").select("id").eq("id", idCobranca).maybeSingle();
        if (existingErr) throw existingErr;
        if (existing) { stats.ignored++; continue; }

        const hub = cell(row, COL.hub) as "IFES" | "GOV";
        const nome = cell(row, COL.nome);
        const normalizedNome = normalizeText(nome);
        const cacheKey = `${hub}::${normalizedNome}`;

        let projectId: string;
        const cached = projectCache.get(cacheKey);
        if (cached) {
          projectId = cached.id;
        } else {
          const { data: existingProject } = await admin.from("projects")
            .select("id, project_stage_id").eq("hub", hub).eq("normalized_name", normalizedNome).eq("active", true).limit(1).maybeSingle();
          if (existingProject) {
            projectId = existingProject.id;
            projectCache.set(cacheKey, { id: projectId, project_stage_id: existingProject.project_stage_id });
          } else {
            let stageId: string | null = null;
            let legacyStageCode: string | null = null;
            if (FASES.has(tipo)) {
              stageId = stageByCode.get(tipo) ?? null;
            } else {
              legacyStageCode = tipo;
              const mapping = legacyMap.get(tipo);
              if (mapping?.mapped_to === "stage" && mapping.target_value) {
                stageId = stageByCode.get(mapping.target_value) ?? null;
              }
            }
            const { data: newProject, error: projectErr } = await admin.from("projects").insert({
              name: nome,
              hub,
              ministry_government: cell(row, COL.min) || null,
              institute: cell(row, COL.inst) || null,
              foundation: cell(row, COL.fund) || null,
              origin: "google_sheets",
              project_status: "active",
              project_stage_id: stageId,
              stage_pending: stageId === null,
              legacy_stage_code: legacyStageCode,
            }).select("id, project_stage_id").single();
            if (projectErr || !newProject) throw projectErr ?? new Error("Falha ao criar projeto.");
            projectId = newProject.id;
            projectCache.set(cacheKey, { id: projectId, project_stage_id: newProject.project_stage_id });
          }
        }

        const statusTexto = cell(row, COL.status);
        const statusMatch = statusTexto ? statusByKey.get(`${hub}::${normalizeText(statusTexto)}`) : undefined;
        const collectionStatusId = statusMatch?.id ?? null;

        const responsavelTexto = cell(row, COL.responsavel);
        const responsibleUserId = responsavelTexto ? profileByName.get(normalizeText(responsavelTexto)) ?? null : null;
        const responsibleLegacyName = responsibleUserId ? null : (responsavelTexto || null);

        const plProjeto = parseBRL(cell(row, COL.plProjeto)) ?? 0;
        const plInnovatis = parseBRL(cell(row, COL.plInnovatis)) ?? 0;
        const recProjeto = receivedRow ? (parseBRL(cell(receivedRow, COL.plProjeto)) ?? 0) : 0;
        const recInnovatis = receivedRow ? (parseBRL(cell(receivedRow, COL.plInnovatis)) ?? 0) : 0;
        const reason = cell(row, COL.motivo) || null;
        const action = cell(row, COL.acao) || null;
        const operationalDeadline = parseDate(cell(row, COL.prazo));
        const flag = cell(row, COL.flag) || null;

        const sourceHash = await computeSourceHash({
          idCobranca, hub, nome, tipo, competence,
          plProjeto, plInnovatis, recProjeto, recInnovatis,
          statusTexto, reason, action, responsavelTexto,
          operationalDeadline, flag,
        });

        const { error: insertErr } = await admin.from("receivables").insert({
          id: idCobranca,
          project_id: projectId,
          competence,
          planned_project: plProjeto,
          planned_innovatis: plInnovatis,
          received_project: recProjeto,
          received_innovatis: recInnovatis,
          collection_status_id: collectionStatusId,
          reason,
          action,
          responsible_user_id: responsibleUserId,
          responsible_legacy_name: responsibleLegacyName,
          operational_deadline: operationalDeadline,
          flag,
          origin: "google_sheets",
          provisional: false,
          source_type: "google_sheets",
          source_sheet_name: sm.sheet_name,
          source_top_row: topRowNumber,
          source_received_row: receivedRowNumber,
          source_hash: sourceHash,
          sync_status: "synchronized",
        });
        if (insertErr) throw insertErr;
        stats.created++;
      } catch (e) {
        stats.errors++;
        issues.push(`Aba "${sm.sheet_name}", linha ${topRowNumber} (ID ${idCobranca}): ${(e as Error).message}`);
      }
    }
  }

  await admin.from("sync_runs").update({
    finished_at: new Date().toISOString(),
    status: stats.errors === 0 ? "success" : "partial",
    records_read: stats.read,
    records_created: stats.created,
    records_updated: 0,
    records_ignored: stats.ignored,
    records_with_errors: stats.errors,
    conflicts: 0,
    details: { issues },
  }).eq("id", runId);

  return json({ runId, read: stats.read, created: stats.created, updated: 0, ignored: stats.ignored, errors: stats.errors, conflicts: 0 });
});
