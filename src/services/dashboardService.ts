import "server-only";
// Agregações da Visão Geral. Calculadas a partir do Supabase (nunca do Sheets).
// Volume V0 (centenas de recebíveis) permite agregar em memória; se crescer, migrar para funções SQL.
import type { Receivable } from "@/types/domain";
import { competenciaAtual, num } from "@/lib/format";

export type Perspectiva = "projeto" | "innovatis" | "ambos";
const previsto = (r: Receivable, p: Perspectiva) => (p === "innovatis" ? 0 : num(r.planned_project)) + (p === "projeto" ? 0 : num(r.planned_innovatis));
const recebido = (r: Receivable, p: Perspectiva) => (p === "innovatis" ? 0 : num(r.received_project)) + (p === "projeto" ? 0 : num(r.received_innovatis));
const saldo = (r: Receivable, p: Perspectiva) => (p === "innovatis" ? 0 : num(r.balance_project)) + (p === "projeto" ? 0 : num(r.balance_innovatis));

export interface Cards { previsto: number; recebido: number; emAberto: number; emAtraso: number; batimento: string; projetosAtrasados: number; recebiveisAtrasados: number; prazosVencidos: number; }
export function cards(rows: Receivable[], p: Perspectiva): Cards {
  const ativos = rows.filter((r) => r.counts_in_portfolio);
  const prev = ativos.reduce((a, r) => a + previsto(r, p), 0), rec = ativos.reduce((a, r) => a + recebido(r, p), 0);
  const atras = ativos.filter((r) => r.is_overdue && saldo(r, p) > 0.01);
  return { previsto: prev, recebido: rec, emAberto: ativos.reduce((a, r) => a + saldo(r, p), 0), emAtraso: atras.reduce((a, r) => a + saldo(r, p), 0),
    batimento: prev > 0 ? `${((rec / prev) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—",
    projetosAtrasados: new Set(atras.map((r) => r.project_id)).size, recebiveisAtrasados: atras.length, prazosVencidos: ativos.filter((r) => r.deadline_overdue).length };
}

export interface LinhaConsolidado { competence: string; hub: string; tipo: "Projeto" | "Innovatis"; previsto: number; recebido: number; saldo: number; }
export function consolidadoMensal(rows: Receivable[]): LinhaConsolidado[] {
  const ativos = rows.filter((r) => r.counts_in_portfolio);
  const comps = [...new Set(ativos.map((r) => r.competence))].sort();
  const out: LinhaConsolidado[] = [];
  const agg = (list: Receivable[], competence: string, hub: string) => (["Projeto", "Innovatis"] as const).forEach((tipo) => {
    const k = tipo === "Projeto" ? "project" : "innovatis";
    out.push({ competence, hub, tipo, previsto: list.reduce((a, r) => a + num(r[`planned_${k}`]), 0), recebido: list.reduce((a, r) => a + num(r[`received_${k}`]), 0), saldo: list.reduce((a, r) => a + num(r[`balance_${k}`]), 0) });
  });
  for (const c of comps) for (const h of ["IFES", "GOV"]) agg(ativos.filter((r) => r.competence === c && r.hub === h), c, h);
  for (const h of ["IFES", "GOV"]) agg(ativos.filter((r) => r.hub === h), "TOTAL", h);
  return out;
}

export interface Graficos {
  porMes: { mes: string; previsto: number; recebido: number }[];
  prazoAtraso: { nome: string; valor: number }[];
  porHub: { nome: string; valor: number }[];
  porEtapa: { nome: string; valor: number }[];
  porResponsavel: { nome: string; valor: number }[];
  top5Atraso: { projeto: string; valor: number; competencia: string; projectId: string }[];
  porFase: { nome: string; valor: number }[];
  carteira: { nome: string; valor: number }[];
}
const soma = (rows: Receivable[], key: (r: Receivable) => string, val: (r: Receivable) => number) => {
  const m = new Map<string, number>(); rows.forEach((r) => m.set(key(r), (m.get(key(r)) ?? 0) + val(r)));
  return [...m.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
};
export function graficos(rows: Receivable[], p: Perspectiva): Graficos {
  const ativos = rows.filter((r) => r.counts_in_portfolio);
  const abertos = ativos.filter((r) => saldo(r, p) > 0.01);
  const comps = [...new Set(ativos.map((r) => r.competence))].sort();
  const atual = competenciaAtual();
  const topMap = new Map<string, { projeto: string; valor: number; competencia: string; projectId: string }>();
  abertos.filter((r) => r.is_overdue).forEach((r) => { const t = topMap.get(r.project_id); if (t) { t.valor += saldo(r, p); if (r.competence < t.competencia) t.competencia = r.competence; } else topMap.set(r.project_id, { projeto: r.project_name, valor: saldo(r, p), competencia: r.competence, projectId: r.project_id }); });
  const projetos = new Map<string, Receivable>(); rows.filter((r) => r.project_active).forEach((r) => projetos.set(r.project_id, r));
  return {
    porMes: comps.map((c) => ({ mes: c, previsto: ativos.filter((r) => r.competence === c).reduce((a, r) => a + previsto(r, p), 0), recebido: ativos.filter((r) => r.competence === c).reduce((a, r) => a + recebido(r, p), 0) })),
    prazoAtraso: [{ nome: "No prazo", valor: abertos.filter((r) => r.competence >= atual).reduce((a, r) => a + saldo(r, p), 0) }, { nome: "Atrasado", valor: abertos.filter((r) => r.is_overdue).reduce((a, r) => a + saldo(r, p), 0) }],
    porHub: soma(abertos, (r) => r.hub, (r) => saldo(r, p)),
    porEtapa: soma(abertos, (r) => r.collection_status_label ?? "Sem etapa", (r) => saldo(r, p)).slice(0, 10),
    porResponsavel: soma(abertos, (r) => r.responsible_name ?? "Sem responsável", (r) => saldo(r, p)).slice(0, 10),
    top5Atraso: [...topMap.values()].sort((a, b) => b.valor - a.valor).slice(0, 5),
    porFase: ["A", "B", "C", "D", "Pendente"].map((f) => ({ nome: f, valor: [...projetos.values()].filter((r) => (r.stage_code ?? "Pendente") === f && r.project_status === "active").length })),
    carteira: ["active", "backlog", "lost"].map((s) => ({ nome: { active: "Ativo", backlog: "Backlog", lost: "Perdido" }[s]!, valor: [...projetos.values()].filter((r) => r.project_status === s).length })),
  };
}
