import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AuditLog, QualityIssue, SyncRun } from "@/types/domain";

export interface FiltrosAuditoria { de?: string; ate?: string; usuario?: string; projeto?: string; campo?: string; acao?: string; origem?: string; sync?: string; page?: number; }
export interface AuditLogEnriched extends AuditLog { project_name: string | null; competence: string | null; }

export async function listarAuditoria(f: FiltrosAuditoria): Promise<{ rows: AuditLogEnriched[]; total: number }> {
  const s = await createClient(); const size = 50, page = Math.max(1, f.page ?? 1);
  let q = s.from("audit_logs").select("*", { count: "exact" }).order("occurred_at", { ascending: false }).range((page - 1) * size, page * size - 1);
  if (f.de) q = q.gte("occurred_at", `${f.de}T00:00:00-03:00`);
  if (f.ate) q = q.lte("occurred_at", `${f.ate}T23:59:59-03:00`);
  if (f.usuario) q = q.or(`actor_email.ilike.%${f.usuario}%,actor_name.ilike.%${f.usuario}%`);
  if (f.campo) q = q.contains("changed_fields", [f.campo]);
  if (f.acao) q = q.eq("action_type", f.acao);
  if (f.origem) q = q.eq("source", f.origem);
  if (f.sync) q = q.eq("sync_status", f.sync);
  const { data, count, error } = await q; if (error) throw error;
  const logs = (data as AuditLog[]) ?? [];
  // Resolve projeto/competência
  const recIds = [...new Set(logs.filter((l) => l.entity_type === "receivables").map((l) => l.entity_id))];
  const projIds = [...new Set(logs.filter((l) => l.entity_type === "projects").map((l) => l.entity_id))];
  const recs = recIds.length ? ((await s.from("receivables").select("id, competence, project_id, projects(name)").in("id", recIds)).data ?? []) : [];
  const projs = projIds.length ? ((await s.from("projects").select("id, name").in("id", projIds)).data ?? []) : [];
  const mr = new Map(recs.map((r) => { const p = r.projects as unknown as { name: string } | { name: string }[] | null; return [r.id, { name: Array.isArray(p) ? p[0]?.name : p?.name, competence: r.competence as string }]; }));
  const mp = new Map(projs.map((p) => [p.id, p.name as string]));
  let rows = logs.map<AuditLogEnriched>((l) => ({ ...l, project_name: mr.get(l.entity_id)?.name ?? mp.get(l.entity_id) ?? null, competence: mr.get(l.entity_id)?.competence ?? null }));
  if (f.projeto) rows = rows.filter((r) => r.project_name?.toLowerCase().includes(f.projeto!.toLowerCase()));
  return { rows, total: count ?? 0 };
}

/** Histórico de um projeto: alterações no cadastro do projeto + em qualquer um dos seus recebíveis. */
export async function historicoProjeto(projectId: string, limite = 20): Promise<AuditLog[]> {
  const s = await createClient();
  const { data: recs } = await s.from("receivables").select("id").eq("project_id", projectId);
  const receivableIds = (recs ?? []).map((r) => r.id as string);
  const filtro = receivableIds.length ? `entity_id.eq.${projectId},entity_id.in.(${receivableIds.join(",")})` : `entity_id.eq.${projectId}`;
  const { data } = await s.from("audit_logs").select("*").in("entity_type", ["projects", "receivables"]).or(filtro).order("occurred_at", { ascending: false }).limit(limite);
  return (data as AuditLog[]) ?? [];
}
export async function listarSyncRuns(): Promise<SyncRun[]> { const s = await createClient(); const { data } = await s.from("sync_runs").select("*").order("started_at", { ascending: false }).limit(50); return (data as SyncRun[]) ?? []; }
export async function contarFila(): Promise<number> { const s = await createClient(); const { count } = await s.from("sync_queue").select("*", { count: "exact", head: true }).eq("status", "pending"); return count ?? 0; }
export async function ultimaSync(): Promise<{ status: string; started_at?: string; finished_at?: string }> { const s = await createClient(); const { data } = await s.rpc("rpc_last_sync"); return (data as { status: string }) ?? { status: "not_configured" }; }
export async function listarQualidade(): Promise<QualityIssue[]> { const s = await createClient(); const { data } = await s.from("v_data_quality_issues").select("*").limit(1000); return (data as QualityIssue[]) ?? []; }
