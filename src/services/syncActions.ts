"use server";
// MUTAÇÕES: carga inicial da base a partir da fonte configurada (Google Sheets hoje).
import { revalidatePath } from "next/cache";
import { exigirPapel } from "./authService";
import { receivablesSource } from "@/integrations/receivables-source";
import type { ImportPreview, ImportResult } from "@/integrations/receivables-source/types";

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
