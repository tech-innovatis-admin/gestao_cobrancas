// FASE 3 — synchronize-google-sheets
// Contrato: ver src/integrations/receivables-source/types.ts e docs/fase-3-google-sheets.md.
// Detecta alterações feitas diretamente na planilha (fora da plataforma) comparando source_hash.
// Roda via cron (service_role) ou disparo manual de um master_admin. Nunca cria recebíveis novos
// (isso é escopo de import-google-sheets) — apenas atualiza ou sinaliza conflito.
import { requireMasterAdminOrService } from "../_shared/auth.ts";
import { accessToken, json, loadConfig, sheetsGet } from "../_shared/google.ts";
import { computeSourceHash } from "../_shared/hash.ts";
import { buildHashFields, parseSheetRows, type RangeSheet } from "../_shared/sheetParser.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  let ctx: Awaited<ReturnType<typeof requireMasterAdminOrService>>;
  try { ctx = await requireMasterAdminOrService(req); } catch (e) { return json({ error: (e as Error).message }, 401); }
  const cfg = loadConfig();
  if ("missing" in cfg) return json({ error: `Configuração pendente: secrets ausentes (${cfg.missing.join(", ")})` }, 503);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: sheetsMap, error: mapErr } = await admin
    .from("sheet_competence_map").select("sheet_name, competence_month, competence_year").eq("active", true);
  if (mapErr) return json({ error: mapErr.message }, 500);
  if (!sheetsMap?.length) return json({ error: "Nenhuma aba ativa em sheet_competence_map." }, 503);

  const { data: runRow, error: runErr } = await admin.from("sync_runs")
    .insert({ type: "synchronize", status: "running", started_by: ctx.user?.id ?? null }).select("id").single();
  if (runErr || !runRow) return json({ error: runErr?.message ?? "Falha ao registrar sync_runs." }, 500);
  const runId = runRow.id as string;

  const token = await accessToken(cfg, "https://www.googleapis.com/auth/spreadsheets.readonly");

  const stats = { read: 0, created: 0, updated: 0, ignored: 0, errors: 0, conflicts: 0 };
  const issues: string[] = [];

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
    const { projects } = parseSheetRows(rows);

    for (const p of projects) {
      if (!p.idCobranca) continue;
      stats.read++;

      try {
        const { data: existing, error: existingErr } = await admin.from("receivables")
          .select("id, source_hash, sync_status").eq("id", p.idCobranca).maybeSingle();
        if (existingErr) throw existingErr;
        if (!existing) { stats.ignored++; continue; }

        const newHash = await computeSourceHash(buildHashFields(p, competence));
        if (newHash === existing.source_hash) { stats.ignored++; continue; }

        if (existing.sync_status !== "pending") {
          const { error: rpcErr } = await admin.rpc("rpc_apply_external_sync", {
            p_id: existing.id,
            p_planned_project: p.plProjeto ?? 0,
            p_planned_innovatis: p.plInnovatis ?? 0,
            p_received_project: p.recProjeto ?? 0,
            p_received_innovatis: p.recInnovatis ?? 0,
            p_reason: p.motivo || null,
            p_action: p.acao || null,
            p_responsible_legacy_name: p.responsavel || null,
            p_new_hash: newHash,
            p_action_type: "external_change",
            p_metadata: { sheet: sm.sheet_name, row: p.rowIndex + 1 },
          });
          if (rpcErr) throw rpcErr;
          stats.updated++;
        } else {
          const { error: updateErr } = await admin.from("receivables")
            .update({ sync_status: "conflict" }).eq("id", p.idCobranca);
          if (updateErr) throw updateErr;
          stats.conflicts++;
        }
      } catch (e) {
        stats.errors++;
        issues.push(`Aba "${sm.sheet_name}", linha ${p.rowIndex + 1} (ID ${p.idCobranca}): ${(e as Error).message}`);
      }
    }
  }

  await admin.from("sync_runs").update({
    finished_at: new Date().toISOString(),
    status: stats.errors === 0 ? "success" : "partial",
    records_read: stats.read,
    records_created: 0,
    records_updated: stats.updated,
    records_ignored: stats.ignored,
    records_with_errors: stats.errors,
    conflicts: stats.conflicts,
    details: { issues },
  }).eq("id", runId);

  return json({ runId, read: stats.read, created: 0, updated: stats.updated, ignored: stats.ignored, errors: stats.errors, conflicts: stats.conflicts });
});
