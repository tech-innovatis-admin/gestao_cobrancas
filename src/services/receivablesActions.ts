"use server";
// MUTAÇÕES: Server Actions → RPCs (SECURITY DEFINER, papel revalidado no banco, auditoria por trigger).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { exigirPapel } from "./authService";
import { projetoSchema, type ProjetoInput } from "@/lib/schemas/projetos";

export type Resultado<T = undefined> = { ok: true; data?: T } | { ok: false; erro: string; conflito?: ConflitoInfo };
export interface ConflitoInfo { current_version: number; current: Record<string, unknown> }
const revalidar = () => ["/visao-geral", "/cobrancas", "/auditoria"].forEach((p) => revalidatePath(p));
const rpc = async (fn: string, args: Record<string, unknown>) => { const s = await createClient(); return s.rpc(fn, args); };
const vazio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const operacional = z.object({ id: z.string().uuid(), expected_version: z.number().int(), collection_status_id: z.string().uuid().nullable(), responsible_user_id: z.string().uuid().nullable(), responsible_legacy_name: z.string().nullable(), operational_deadline: z.string().nullable(), reason: z.string().nullable(), action: z.string().nullable() });
export type OperacionalInput = z.infer<typeof operacional>;
export async function salvarOperacional(input: OperacionalInput): Promise<Resultado<{ changed: boolean; version: number }>> {
  await exigirPapel("operator", "master_admin");
  const s = operacional.safeParse(input); if (!s.success) return { ok: false, erro: s.error.issues[0].message };
  const d = s.data;
  const { data, error } = await rpc("rpc_update_receivable_operational", { p_id: d.id, p_expected_version: d.expected_version, p_collection_status_id: d.collection_status_id, p_responsible_user_id: d.responsible_user_id, p_responsible_legacy_name: vazio(d.responsible_legacy_name), p_operational_deadline: vazio(d.operational_deadline), p_reason: vazio(d.reason), p_action: vazio(d.action) });
  if (error) return { ok: false, erro: error.message };
  if (data?.conflict) return { ok: false, erro: "Outra pessoa alterou este recebível.", conflito: { current_version: data.current_version, current: data.current } };
  revalidar(); return { ok: true, data: { changed: !!data?.changed, version: data?.version } };
}

const recibo = z.object({ id: z.string().uuid(), received_project: z.number().min(0), received_innovatis: z.number().min(0), received_date: z.string().nullable(), invoice_number: z.string().nullable(), note: z.string().nullable(), justification: z.string().nullable() });
export async function registrarRecebimento(input: z.infer<typeof recibo>): Promise<Resultado> {
  await exigirPapel("master_admin");
  const s = recibo.safeParse(input); if (!s.success) return { ok: false, erro: s.error.issues[0].message };
  const d = s.data;
  const { error } = await rpc("rpc_register_receipt", { p_id: d.id, p_received_project: d.received_project, p_received_innovatis: d.received_innovatis, p_received_date: vazio(d.received_date), p_invoice_number: vazio(d.invoice_number), p_note: vazio(d.note), p_justification: vazio(d.justification) });
  if (error) return { ok: false, erro: error.message }; revalidar(); return { ok: true };
}

const financeiro = z.object({ id: z.string().uuid(), planned_project: z.number().min(0), planned_innovatis: z.number().min(0), received_project: z.number().min(0), received_innovatis: z.number().min(0), competence: z.string(), flag: z.string().nullable(), origin: z.enum(["google_sheets", "crm", "platform", "future_financial_database"]), provisional: z.boolean(), legacy_consolidated: z.boolean(), justification: z.string().nullable() });
export async function salvarFinanceiro(input: z.infer<typeof financeiro>): Promise<Resultado> {
  await exigirPapel("master_admin");
  const s = financeiro.safeParse(input); if (!s.success) return { ok: false, erro: s.error.issues[0].message };
  const d = s.data;
  const { error } = await rpc("rpc_update_receivable_financial", { p_id: d.id, p_planned_project: d.planned_project, p_planned_innovatis: d.planned_innovatis, p_received_project: d.received_project, p_received_innovatis: d.received_innovatis, p_competence: d.competence, p_flag: vazio(d.flag), p_origin: d.origin, p_provisional: d.provisional, p_legacy_consolidated: d.legacy_consolidated, p_justification: vazio(d.justification) });
  if (error) return { ok: false, erro: error.message }; revalidar(); return { ok: true };
}

const novoRecebivel = z.object({ project_id: z.string().uuid(), competence: z.string(), planned_project: z.number().min(0), planned_innovatis: z.number().min(0), received_project: z.number().min(0), received_innovatis: z.number().min(0), collection_status_id: z.string().uuid().nullable(), reason: z.string().nullable(), action: z.string().nullable(), responsible_user_id: z.string().uuid().nullable(), responsible_legacy_name: z.string().nullable(), operational_deadline: z.string().nullable(), flag: z.string().nullable(), origin: z.enum(["google_sheets", "crm", "platform", "future_financial_database"]), provisional: z.boolean() });
export type NovoRecebivelInput = z.infer<typeof novoRecebivel>;
export async function criarRecebivel(input: NovoRecebivelInput): Promise<Resultado<{ id: string }>> {
  await exigirPapel("master_admin");
  const s = novoRecebivel.safeParse(input); if (!s.success) return { ok: false, erro: s.error.issues[0].message };
  const d = s.data;
  const { data, error } = await rpc("rpc_create_receivable", { p_project_id: d.project_id, p_competence: d.competence, p_planned_project: d.planned_project, p_planned_innovatis: d.planned_innovatis, p_received_project: d.received_project, p_received_innovatis: d.received_innovatis, p_collection_status_id: d.collection_status_id, p_reason: vazio(d.reason), p_action: vazio(d.action), p_responsible_user_id: d.responsible_user_id, p_responsible_legacy_name: vazio(d.responsible_legacy_name), p_operational_deadline: vazio(d.operational_deadline), p_flag: vazio(d.flag), p_origin: d.origin, p_provisional: d.provisional });
  if (error) return { ok: false, erro: error.message }; revalidar(); return { ok: true, data: { id: data as string } };
}

// ---- projetos
export async function criarProjeto(input: ProjetoInput): Promise<Resultado<{ id: string }>> {
  await exigirPapel("master_admin");
  const s = projetoSchema.safeParse(input); if (!s.success) return { ok: false, erro: s.error.issues[0].message };
  const d = s.data;
  const { data, error } = await rpc("rpc_create_project", { p_name: d.name, p_stage_code: d.stage_code, p_project_status: d.project_status, p_hub: d.hub, p_ministry_government: vazio(d.ministry_government), p_institute: vazio(d.institute), p_foundation: vazio(d.foundation), p_origin: d.origin, p_provisional: d.provisional, p_notes: vazio(d.notes) });
  if (error) return { ok: false, erro: error.message }; revalidar(); return { ok: true, data: { id: data as string } };
}
export async function editarProjeto(id: string, input: Omit<ProjetoInput, "stage_code" | "project_status">): Promise<Resultado> {
  await exigirPapel("master_admin");
  const { error } = await rpc("rpc_update_project", { p_id: id, p_name: input.name, p_hub: input.hub, p_ministry_government: vazio(input.ministry_government), p_institute: vazio(input.institute), p_foundation: vazio(input.foundation), p_origin: input.origin, p_provisional: input.provisional, p_notes: vazio(input.notes) });
  if (error) return { ok: false, erro: error.message }; revalidar(); return { ok: true };
}
export async function alterarFase(id: string, stage_code: string, justification: string | null): Promise<Resultado> {
  await exigirPapel("master_admin");
  const { error } = await rpc("rpc_set_project_stage", { p_id: id, p_stage_code: stage_code, p_justification: vazio(justification) });
  if (error) return { ok: false, erro: error.message }; revalidar(); return { ok: true };
}
export async function alterarSituacao(id: string, status: "active" | "backlog" | "lost", justification: string | null, stage_code: string | null): Promise<Resultado> {
  await exigirPapel("master_admin");
  const { error } = await rpc("rpc_set_project_status", { p_id: id, p_status: status, p_justification: vazio(justification), p_stage_code: stage_code });
  if (error) return { ok: false, erro: error.message }; revalidar(); return { ok: true };
}
export async function excluirDaGestao(id: string, reason: string): Promise<Resultado> {
  await exigirPapel("master_admin");
  const { error } = await rpc("rpc_archive_project", { p_id: id, p_reason: reason });
  if (error) return { ok: false, erro: error.message }; revalidar(); return { ok: true };
}
export async function restaurarProjeto(id: string): Promise<Resultado> {
  await exigirPapel("master_admin");
  const { error } = await rpc("rpc_restore_project", { p_id: id });
  if (error) return { ok: false, erro: error.message }; revalidar(); return { ok: true };
}
