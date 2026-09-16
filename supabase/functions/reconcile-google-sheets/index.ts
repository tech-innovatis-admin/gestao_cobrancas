// FASE 3 — reconcile-google-sheets
// Compara os totais consolidados da aba "Dashboard" da planilha contra os totais agregados no
// Postgres (receivables x projects), com tolerância de R$ 0,01, e reporta divergências.
// NUNCA corrige nada automaticamente — é só um relatório de auditoria. Decisão sempre humana:
// exige master_admin, jamais roda via cron.
import { requireMasterAdmin } from "../_shared/auth.ts";
import { accessToken, json, loadConfig, sheetsGet } from "../_shared/google.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type Hub = "IFES" | "GOV";
type Tipo = "Projeto" | "Innovatis";

interface SheetLine { monthLabel: string; hub: Hub; tipo: Tipo; planejado: number; recebido: number }

interface Mismatch {
  competence: string;
  hub: Hub;
  tipo: Tipo;
  sheetPlanned: number;
  dbPlanned: number;
  sheetReceived: number;
  dbReceived: number;
}

const TOLERANCE = 0.01;

// Mesma lógica de parse BR de valores monetários usada em import-google-sheets, com o adicional
// de tratar "-" (traço solto, sem dígitos) como zero — é assim que a aba "Dashboard" representa
// valores nulos nessas colunas.
function parseBRL(s: string): number | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  if (/^-+$/.test(t)) return 0;
  const n = Number(t.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// "março" chega com cedilha (ç) — normalizamos removendo diacríticos (NFD + strip combining
// marks) antes de comparar, assim variações de acentuação/case não quebram o lookup.
function stripAccents(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

function monthLabelToCompetence(label: string): string | null {
  const parts = label.split("/");
  if (parts.length !== 2) return null;
  const monthName = stripAccents(parts[0]);
  const year = parts[1].trim();
  const monthNum = MESES[monthName];
  if (!monthNum || !/^\d{4}$/.test(year)) return null;
  return `${year}-${String(monthNum).padStart(2, "0")}-01`;
}

Deno.serve(async (req) => {
  try { await requireMasterAdmin(req); } catch (e) { return json({ error: (e as Error).message }, 401); }
  const cfg = loadConfig();
  if ("missing" in cfg) return json({ error: `Configuração pendente: secrets ausentes (${cfg.missing.join(", ")})` }, 503);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let values: string[][];
  try {
    const token = await accessToken(cfg, "https://www.googleapis.com/auth/spreadsheets.readonly");
    const res = await sheetsGet<{ values?: string[][] }>(cfg, token, `/values/${encodeURIComponent("Dashboard!A1:I40")}`);
    values = res.values ?? [];
  } catch (e) {
    return json({ error: `Falha ao ler a aba "Dashboard": ${(e as Error).message}` }, 500);
  }
  if (values.length < 8) return json({ error: 'Aba "Dashboard" sem dados suficientes (esperado cabeçalho na linha 7 e dados a partir da linha 8).' }, 500);

  // Índices 0-based das colunas relevantes (A..I): C=2 Mês, D=3 Vertical(hub), E=4 Tipo de Valor,
  // F=5 A Receber, G=6 Recebido.
  const sheetLines: SheetLine[] = [];
  let currentMonth = "";
  let currentHub: Hub | "" = "";

  try {
    for (let i = 7; i < values.length; i++) {
      const row = values[i] ?? [];
      const cell = (idx: number) => (row[idx] ?? "").toString().trim();
      const mes = cell(2);
      const hubTexto = cell(3);
      const tipoTexto = cell(4);
      const planejadoRaw = cell(5);
      const recebidoRaw = cell(6);

      // Linha em branco (ou sem nada nas colunas C-I) marca o fim da tabela.
      if (!mes && !hubTexto && !tipoTexto && !planejadoRaw && !recebidoRaw) break;

      // "Tipo de Valor" não reconhecido (nem "Projeto" nem "Innovatis") também encerra a leitura —
      // evita interpretar rodapés/observações da planilha como dados.
      if (tipoTexto !== "Projeto" && tipoTexto !== "Innovatis") break;

      if (mes) currentMonth = mes; // forward-fill: só a 1ª linha de cada bloco de 4 tem o mês
      if (hubTexto === "IFES" || hubTexto === "GOV") currentHub = hubTexto; // forward-fill dentro do bloco

      if (!currentMonth || !currentHub) break; // dados incompletos — não dá pra confiar no resto

      const planejado = parseBRL(planejadoRaw);
      const recebido = parseBRL(recebidoRaw);
      if (planejado === null || recebido === null) {
        throw new Error(`Linha ${i + 1} da aba "Dashboard": não foi possível interpretar valor monetário ("${planejadoRaw}" / "${recebidoRaw}").`);
      }

      sheetLines.push({ monthLabel: currentMonth, hub: currentHub, tipo: tipoTexto, planejado, recebido });
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }

  if (!sheetLines.length) return json({ error: 'Nenhuma linha de dados reconhecida na aba "Dashboard" (verifique o layout esperado A1:I40).' }, 500);

  // Agrega em caso de meses repetidos no mesmo hub/tipo (não deveria acontecer, mas somamos por
  // segurança em vez de sobrescrever).
  const sheetByKey = new Map<string, SheetLine & { competence: string }>();
  for (const line of sheetLines) {
    const competence = monthLabelToCompetence(line.monthLabel);
    if (!competence) return json({ error: `Mês não reconhecido na aba "Dashboard": "${line.monthLabel}".` }, 500);
    const key = `${competence}::${line.hub}::${line.tipo}`;
    const existing = sheetByKey.get(key);
    if (existing) {
      existing.planejado += line.planejado;
      existing.recebido += line.recebido;
    } else {
      sheetByKey.set(key, { ...line, competence });
    }
  }

  // Totais do banco, por (competence, hub) — soma planned_project/received_project (tipo
  // "Projeto") e planned_innovatis/received_innovatis (tipo "Innovatis") entre receivables
  // ativos de projetos ativos.
  const dbTotals = new Map<string, { planned: number; received: number }>();
  const competenceHubPairs = new Map<string, { competence: string; hub: Hub }>();
  for (const { competence, hub } of sheetByKey.values()) competenceHubPairs.set(`${competence}::${hub}`, { competence, hub });

  for (const { competence, hub } of competenceHubPairs.values()) {
    const { data: rows, error } = await admin
      .from("receivables")
      .select("planned_project, planned_innovatis, received_project, received_innovatis, projects!inner(hub, active)")
      .eq("competence", competence)
      .eq("active", true)
      .eq("projects.hub", hub)
      .eq("projects.active", true);
    if (error) return json({ error: `Falha ao consultar receivables (${competence}, ${hub}): ${error.message}` }, 500);

    let plannedProjeto = 0, receivedProjeto = 0, plannedInnovatis = 0, receivedInnovatis = 0;
    for (const r of rows ?? []) {
      plannedProjeto += Number(r.planned_project ?? 0);
      receivedProjeto += Number(r.received_project ?? 0);
      plannedInnovatis += Number(r.planned_innovatis ?? 0);
      receivedInnovatis += Number(r.received_innovatis ?? 0);
    }
    dbTotals.set(`${competence}::${hub}::Projeto`, { planned: plannedProjeto, received: receivedProjeto });
    dbTotals.set(`${competence}::${hub}::Innovatis`, { planned: plannedInnovatis, received: receivedInnovatis });
  }

  const mismatches: Mismatch[] = [];
  let checked = 0;
  for (const [key, line] of sheetByKey) {
    checked++;
    const db = dbTotals.get(key) ?? { planned: 0, received: 0 };
    const plannedDiff = Math.abs(line.planejado - db.planned);
    const receivedDiff = Math.abs(line.recebido - db.received);
    if (plannedDiff > TOLERANCE || receivedDiff > TOLERANCE) {
      mismatches.push({
        competence: line.competence,
        hub: line.hub,
        tipo: line.tipo,
        sheetPlanned: line.planejado,
        dbPlanned: db.planned,
        sheetReceived: line.recebido,
        dbReceived: db.received,
      });
    }
  }

  const { data: runRow, error: runErr } = await admin.from("sync_runs").insert({
    type: "reconcile",
    status: "success",
    finished_at: new Date().toISOString(),
    records_read: sheetLines.length,
    records_with_errors: mismatches.length,
    details: { mismatches },
  }).select("id").single();
  if (runErr || !runRow) return json({ error: runErr?.message ?? "Falha ao registrar sync_runs." }, 500);

  return json({ runId: runRow.id, checked, mismatches });
});
