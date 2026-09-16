// FASE 3 — escreve de volta na planilha os campos operacionais/financeiros alterados pela plataforma.
// Colunas fixas (nunca as calculadas N/O/Q): G/H = planejado, I..M = operacional.
import { accessToken, sheetsValuesBatchUpdate, type GoogleConfig } from "./google.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type AdminClient = ReturnType<typeof createClient>;

export interface OperationalWritebackFields {
  collection_status_id: string | null; responsible_legacy_name: string | null;
  operational_deadline: string | null; reason: string | null; action: string | null;
}
export interface FinancialWritebackFields {
  planned_project: number; planned_innovatis: number; received_project: number; received_innovatis: number;
}

const COL_PL_PROJETO = "G", COL_PL_INNOVATIS = "H";
const COL_STATUS = "I", COL_MOTIVO = "J", COL_ACAO = "K", COL_RESP = "L", COL_PRAZO = "M";

export async function writebackOperational(admin: AdminClient, cfg: GoogleConfig, receivableId: string, fields: OperationalWritebackFields): Promise<void> {
  const { data: r, error } = await admin.from("receivables").select("source_sheet_name, source_top_row").eq("id", receivableId).single();
  if (error || !r?.source_sheet_name || !r.source_top_row) throw new Error("Recebível sem vínculo com a planilha (source_sheet_name/source_top_row ausentes).");
  let statusLabel = "";
  if (fields.collection_status_id) {
    const { data: st } = await admin.from("collection_status_catalog").select("source_label").eq("id", fields.collection_status_id).single();
    statusLabel = st?.source_label ?? "";
  }
  const token = await accessToken(cfg);
  await sheetsValuesBatchUpdate(cfg, token, [
    { range: `'${r.source_sheet_name}'!${COL_STATUS}${r.source_top_row}`, values: [[statusLabel]] },
    { range: `'${r.source_sheet_name}'!${COL_MOTIVO}${r.source_top_row}`, values: [[fields.reason ?? ""]] },
    { range: `'${r.source_sheet_name}'!${COL_ACAO}${r.source_top_row}`, values: [[fields.action ?? ""]] },
    { range: `'${r.source_sheet_name}'!${COL_RESP}${r.source_top_row}`, values: [[fields.responsible_legacy_name ?? ""]] },
    { range: `'${r.source_sheet_name}'!${COL_PRAZO}${r.source_top_row}`, values: [[fields.operational_deadline ?? ""]] },
  ]);
}

export async function writebackFinancial(admin: AdminClient, cfg: GoogleConfig, receivableId: string, fields: FinancialWritebackFields): Promise<void> {
  const { data: r, error } = await admin.from("receivables").select("source_sheet_name, source_top_row, source_received_row").eq("id", receivableId).single();
  if (error || !r?.source_sheet_name || !r.source_top_row) throw new Error("Recebível sem vínculo com a planilha (source_sheet_name/source_top_row ausentes).");
  const token = await accessToken(cfg);
  const writes = [
    { range: `'${r.source_sheet_name}'!${COL_PL_PROJETO}${r.source_top_row}`, values: [[String(fields.planned_project)]] },
    { range: `'${r.source_sheet_name}'!${COL_PL_INNOVATIS}${r.source_top_row}`, values: [[String(fields.planned_innovatis)]] },
  ];
  if (r.source_received_row) {
    writes.push({ range: `'${r.source_sheet_name}'!${COL_PL_PROJETO}${r.source_received_row}`, values: [[String(fields.received_project)]] });
    writes.push({ range: `'${r.source_sheet_name}'!${COL_PL_INNOVATIS}${r.source_received_row}`, values: [[String(fields.received_innovatis)]] });
  }
  await sheetsValuesBatchUpdate(cfg, token, writes);
}
