import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ReceivablesSourceAdapter, ImportPreview, ImportResult, InitializeResult, SourceStatus, QueueResult, ConflictResolution } from "./types";
import type { Receivable } from "@/types/domain";

/**
 * Adaptador da planilha legada. Toda comunicação com o Google acontece nas Edge Functions
 * (supabase/functions/*). Aqui só invocamos as funções; nomes de abas, linhas e células
 * NUNCA chegam ao React. Estado atual: Edge Functions da FASE 3 — "Configuração pendente".
 */
const invoke = async <T>(fn: string, body?: Record<string, unknown>): Promise<T> => {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke<T>(fn, { body });
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
};

export const googleSheetsLegacyAdapter: ReceivablesSourceAdapter = {
  name: "GoogleSheetsLegacyAdapter",
  async healthCheck(): Promise<SourceStatus> {
    try { return await invoke<SourceStatus>("google-sheets-health-check"); }
    catch (e) { return { configured: false, healthy: false, message: `Configuração pendente: ${(e as Error).message}` }; }
  },
  initialize: () => invoke<InitializeResult>("initialize-google-sheets"),
  previewImport: () => invoke<ImportPreview>("preview-google-sheets-import"),
  importData: () => invoke<ImportResult>("import-google-sheets"),
  synchronize: () => invoke<ImportResult>("synchronize-google-sheets"),
  async getReceivables(): Promise<Receivable[]> {
    // Após a importação os dados vivem no Supabase; leitura nunca vai ao Google.
    const supabase = await createClient();
    const { data, error } = await supabase.from("v_receivables_enriched").select("*").eq("source_type", "google_sheets");
    if (error) throw error; return data as Receivable[];
  },
  updateOperationalFields: (id, fields) => invoke<void>("update-receivable-operational", { id, ...fields }),
  updateFinancialFields: (id, fields) => invoke<void>("update-receivable-financial", { id, ...fields }),
  retryQueue: () => invoke<QueueResult>("process-sync-queue"),
  resolveConflict: (receivableId: string, resolution: ConflictResolution) =>
    invoke<{ ok: boolean }>("resolve-sync-conflict", { receivable_id: receivableId, resolution }),
};
