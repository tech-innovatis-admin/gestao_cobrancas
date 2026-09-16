// FASE 3 — resolve-sync-conflict
// Contrato: ver src/integrations/receivables-source/types.ts e docs/fase-3-google-sheets.md.
// Decisão humana explícita (sempre master_admin) para resolver um recebível em sync_status = 'conflict':
// manter o valor da plataforma (enfileira write-back para a planilha) ou aceitar o valor da planilha
// (aplica via rpc_apply_external_sync, igual ao fluxo de synchronize-google-sheets).
import { requireMasterAdmin } from "../_shared/auth.ts";
import { accessToken, json, loadConfig, sheetsGet } from "../_shared/google.ts";
import { computeSourceHash } from "../_shared/hash.ts";
import { buildHashFields, parseSheetRows, type RangeSheet } from "../_shared/sheetParser.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

interface Body { receivable_id?: string; resolution?: "keep_platform" | "keep_sheet"; }

Deno.serve(async (req) => {
  try { await requireMasterAdmin(req); } catch (e) { return json({ error: (e as Error).message }, 401); }
  const cfg = loadConfig();
  if ("missing" in cfg) return json({ error: `Configuração pendente: secrets ausentes (${cfg.missing.join(", ")})` }, 503);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "Corpo inválido." }, 400); }
  const { receivable_id, resolution } = body;
  if (!receivable_id) return json({ error: "receivable_id é obrigatório." }, 400);
  if (resolution !== "keep_platform" && resolution !== "keep_sheet") {
    return json({ error: "resolution deve ser 'keep_platform' ou 'keep_sheet'." }, 400);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: r, error: rErr } = await admin.from("receivables").select("*").eq("id", receivable_id).maybeSingle();
  if (rErr) return json({ error: rErr.message }, 500);
  if (!r) return json({ error: "Recebível não encontrado." }, 404);
  if (r.sync_status !== "conflict") return json({ error: "Recebível não está em conflito." }, 400);

  if (resolution === "keep_platform") {
    const { error: q1Err } = await admin.from("sync_queue").insert([
      {
        receivable_id,
        operation: "writeback_operational",
        payload: {
          collection_status_id: r.collection_status_id,
          responsible_legacy_name: r.responsible_legacy_name,
          operational_deadline: r.operational_deadline,
          reason: r.reason,
          action: r.action,
          version: r.source_version,
        },
      },
      {
        receivable_id,
        operation: "writeback_financial",
        payload: {
          planned_project: r.planned_project,
          planned_innovatis: r.planned_innovatis,
          received_project: r.received_project,
          received_innovatis: r.received_innovatis,
          version: r.source_version,
        },
      },
    ]);
    if (q1Err) return json({ error: q1Err.message }, 500);

    const { error: updErr } = await admin.from("receivables").update({ sync_status: "pending" }).eq("id", receivable_id);
    if (updErr) return json({ error: updErr.message }, 500);

    return json({ ok: true, resolution: "keep_platform", queued: true });
  }

  // keep_sheet
  if (!r.source_sheet_name) return json({ error: "Recebível sem source_sheet_name — não é possível reler a planilha." }, 400);

  const token = await accessToken(cfg, "https://www.googleapis.com/auth/spreadsheets.readonly");
  let sheet: RangeSheet | undefined;
  try {
    const range = `?ranges=${encodeURIComponent(`'${r.source_sheet_name}'!A1:R2000`)}&fields=${encodeURIComponent("sheets(data.rowData.values(formattedValue))")}&includeGridData=true`;
    const res = await sheetsGet<{ sheets?: RangeSheet[] }>(cfg, token, range);
    sheet = res.sheets?.[0];
  } catch (e) {
    return json({ error: `Falha ao ler a aba "${r.source_sheet_name}": ${(e as Error).message}` }, 500);
  }
  const rows = sheet?.data?.[0]?.rowData ?? [];
  const { projects } = parseSheetRows(rows);
  const p = projects.find((row) => row.idCobranca === receivable_id);
  if (!p) return json({ error: `Linha com ID_COBRANCA ${receivable_id} não encontrada na aba "${r.source_sheet_name}".` }, 404);

  const competence = `${r.competence.slice(0, 7)}-01`;

  const newHash = await computeSourceHash(buildHashFields(p, competence));
  const { error: rpcErr } = await admin.rpc("rpc_apply_external_sync", {
    p_id: receivable_id,
    p_planned_project: p.plProjeto ?? 0,
    p_planned_innovatis: p.plInnovatis ?? 0,
    p_received_project: p.recProjeto ?? 0,
    p_received_innovatis: p.recInnovatis ?? 0,
    p_reason: p.motivo || null,
    p_action: p.acao || null,
    p_responsible_legacy_name: p.responsavel || null,
    p_new_hash: newHash,
    p_action_type: "conflict_resolved_keep_sheet",
    p_metadata: { sheet: r.source_sheet_name, row: p.rowIndex + 1 },
  });
  if (rpcErr) return json({ error: rpcErr.message }, 500);

  return json({ ok: true, resolution: "keep_sheet" });
});
