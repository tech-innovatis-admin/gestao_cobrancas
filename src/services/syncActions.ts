"use server";
// MUTAÇÕES: carga inicial da base a partir da fonte configurada (Google Sheets hoje).
import { revalidatePath } from "next/cache";
import { exigirPapel } from "./authService";
import { createClient } from "@/lib/supabase/server";
import { receivablesSource } from "@/integrations/receivables-source";
import type { ImportPreview, ImportResult, QueueResult, ConflictResolution } from "@/integrations/receivables-source/types";

const revalidar = () => ["/visao-geral", "/cobrancas", "/auditoria"].forEach((p) => revalidatePath(p));

export async function previewCargaInicial(): Promise<ImportPreview> {
  await exigirPapel("master_admin");
  return receivablesSource.previewImport();
}

export async function executarCargaInicial(): Promise<ImportResult> {
  await exigirPapel("master_admin");
  await receivablesSource.initialize();
  const resultado = await receivablesSource.importData();
  revalidar();
  return resultado;
}

export async function rodarSincronizacao(): Promise<ImportResult> {
  await exigirPapel("master_admin");
  const resultado = await receivablesSource.synchronize();
  revalidar();
  return resultado;
}

export async function reprocessarFila(): Promise<QueueResult> {
  await exigirPapel("master_admin");
  const resultado = await receivablesSource.retryQueue();
  revalidar();
  return resultado;
}

export async function resolverConflito(receivableId: string, resolution: ConflictResolution): Promise<{ ok: boolean }> {
  await exigirPapel("master_admin");
  const resultado = await receivablesSource.resolveConflict(receivableId, resolution);
  revalidar();
  return resultado;
}

export interface ReconciliationMismatch {
  competence: string; hub: string; tipo: "Projeto" | "Innovatis";
  sheetPlanned: number; dbPlanned: number; sheetReceived: number; dbReceived: number;
}
export interface ReconciliationResult { runId: string; checked: number; mismatches: ReconciliationMismatch[]; }

export async function rodarReconciliacao(): Promise<ReconciliationResult> {
  await exigirPapel("master_admin");
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("reconcile-google-sheets");
  if (error) throw new Error(error.message);
  revalidar();
  return data as ReconciliationResult;
}
