import "server-only";
// LEITURA de recebíveis: sempre do Supabase (v_receivables_enriched). Nunca do Google Sheets.
import { createClient } from "@/lib/supabase/server";
import { competenciaAtual } from "@/lib/format";
import type { FinStatus, Hub, ProjectStatus, Receivable, RecordOrigin } from "@/types/domain";

export type FiltroRapido = "atrasados" | "mes_atual" | "atrasados_mes_atual" | "proximos" | "todos" | "mes" | "minhas" | "prazo_vencido";
export interface Filtros {
  rapido?: FiltroRapido; competencia?: string; hub?: Hub; foundation?: string; institute?: string; ministry?: string;
  q?: string; stage?: string; status?: ProjectStatus | "all"; etapa?: string; responsavel?: string; origem?: RecordOrigin;
  provisorios?: "1" | "0"; fin?: FinStatus; prazoVencido?: "1"; flag?: string; receivable?: string;
  page?: number; pageSize?: number; sort?: string; dir?: "asc" | "desc"; userId?: string;
}
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
const SORTS = new Set(["competence", "project_name", "hub", "balance_project", "balance_innovatis", "planned_project", "received_project", "operational_deadline", "updated_at", "stage_code", "responsible_name", "collection_status_label"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Builder = any; // PostgrestFilterBuilder genérico; tipagem forte virá com `supabase gen types`
function aplicar(q: Builder, f: Filtros): Builder {
  let b = q.eq("active", true);
  const atual = competenciaAtual();
  b = f.status === "all" ? b : b.eq("project_status", f.status ?? "active");
  if (f.provisorios === "0") b = b.eq("provisional", false);
  if (f.hub) b = b.eq("hub", f.hub);
  if (f.foundation) b = b.eq("foundation", f.foundation);
  if (f.institute) b = b.eq("institute", f.institute);
  if (f.ministry) b = b.eq("ministry_government", f.ministry);
  if (f.stage) b = b.eq("stage_code", f.stage);
  if (f.etapa) b = b.eq("collection_status_id", f.etapa);
  if (f.responsavel) b = b.eq("responsible_name", f.responsavel);
  if (f.origem) b = b.eq("origin", f.origem);
  if (f.fin) b = b.eq("overall_financial_status", f.fin);
  if (f.flag) b = b.eq("flag", f.flag);
  if (f.prazoVencido === "1") b = b.eq("deadline_overdue", true);
  if (f.q) b = b.ilike("search_text", `%${norm(f.q)}%`);
  if (f.receivable) b = b.eq("id", f.receivable);
  switch (f.rapido) {
    case "atrasados": b = b.eq("is_overdue", true); break;
    case "mes_atual": b = b.eq("competence", atual); break;
    case "atrasados_mes_atual": b = b.or(`is_overdue.eq.true,competence.eq.${atual}`); break;
    case "proximos": b = b.gt("competence", atual); break;
    case "prazo_vencido": b = b.eq("deadline_overdue", true); break;
    case "minhas": if (f.userId) b = b.eq("responsible_user_id", f.userId); break;
    case "mes": if (f.competencia) b = b.eq("competence", f.competencia); break;
    default: if (f.competencia) b = b.eq("competence", f.competencia);
  }
  return b;
}

/** Paginação server-side. */
export async function listarRecebiveis(f: Filtros): Promise<{ rows: Receivable[]; total: number }> {
  const supabase = await createClient();
  const size = [25, 50, 100].includes(f.pageSize ?? 0) ? f.pageSize! : 25;
  const page = Math.max(1, f.page ?? 1);
  const sort = SORTS.has(f.sort ?? "") ? f.sort! : "competence";
  const q = aplicar(supabase.from("v_receivables_enriched").select("*", { count: "exact" }), f)
    .order(sort, { ascending: f.dir !== "desc", nullsFirst: false }).order("hub").order("balance_project", { ascending: false })
    .range((page - 1) * size, page * size - 1);
  const { data, count, error } = await q;
  if (error) throw error;
  return { rows: (data as Receivable[]) ?? [], total: count ?? 0 };
}

/** Sem paginação — para agregações do dashboard e exportação (limite defensivo). */
export async function listarRecebiveisTodos(f: Filtros, limite = 5000): Promise<Receivable[]> {
  const supabase = await createClient();
  const { data, error } = await aplicar(supabase.from("v_receivables_enriched").select("*"), f).order("competence").limit(limite);
  if (error) throw error;
  return (data as Receivable[]) ?? [];
}

export async function obterRecebivel(id: string): Promise<Receivable | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("v_receivables_enriched").select("*").eq("id", id).maybeSingle<Receivable>();
  return data ?? null;
}

/** Todos os recebíveis (competências) de um projeto — página de detalhe do projeto. */
export async function listarRecebiveisPorProjeto(projectId: string): Promise<Receivable[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_receivables_enriched").select("*").eq("project_id", projectId).eq("active", true).order("competence");
  if (error) throw error;
  return (data as Receivable[]) ?? [];
}

export async function opcoesDeFiltro() {
  const supabase = await createClient();
  const { data } = await supabase.from("v_receivables_enriched").select("foundation, institute, ministry_government, responsible_name, flag, competence, project_id, project_name").eq("active", true).limit(5000);
  const uniq = (k: string) => [...new Set((data ?? []).map((r) => (r as Record<string, string | null>)[k]).filter((v): v is string => !!v))].sort();
  const projetos = [...new Map((data ?? []).map((r) => [r.project_id, { id: r.project_id as string, nome: r.project_name as string }])).values()].sort((a, b) => a.nome.localeCompare(b.nome));
  return { fundacoes: uniq("foundation"), institutos: uniq("institute"), ministerios: uniq("ministry_government"), responsaveis: uniq("responsible_name"), flags: uniq("flag"), competencias: uniq("competence"), projetos };
}
