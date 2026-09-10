"use client";
import { ArrowDown, ArrowUp, Download } from "lucide-react";
import { useUrlFiltros } from "@/components/filtros/use-url-filtros";
import { cn } from "@/lib/utils";
import { fmtBRL, fmtCompetencia, fmtData, fmtDataHora } from "@/lib/format";
import { BadgeConsolidado, BadgeFase, BadgeFin, BadgeProvisorio, BadgeSync } from "@/components/ui/badges-dominio";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/basicos";
import { Paginacao } from "./paginacao";
import { exportarCsv } from "./exportar";
import { ORIGIN_LABEL, type Receivable } from "@/types/domain";

const COLS: { k: string; l: string; num?: boolean; sort?: string; fix?: boolean }[] = [
  { k: "stage", l: "Fase", sort: "stage_code", fix: true }, { k: "comp", l: "Competência", sort: "competence", fix: true }, { k: "hub", l: "HUB", sort: "hub" }, { k: "min", l: "Ministério/Governo" }, { k: "inst", l: "Instituto" }, { k: "fund", l: "Fundação" }, { k: "proj", l: "Projeto", sort: "project_name" },
  { k: "pp", l: "Previsto Proj.", num: true, sort: "planned_project" }, { k: "rp", l: "Recebido Proj.", num: true, sort: "received_project" }, { k: "sp", l: "Saldo Proj.", num: true, sort: "balance_project" },
  { k: "pi", l: "Previsto Innov.", num: true }, { k: "ri", l: "Recebido Innov.", num: true }, { k: "si", l: "Saldo Innov.", num: true, sort: "balance_innovatis" },
  { k: "etapa", l: "Etapa da cobrança", sort: "collection_status_label" }, { k: "motivo", l: "Motivo" }, { k: "acao", l: "Ação" }, { k: "resp", l: "Responsável", sort: "responsible_name" }, { k: "prazo", l: "Prazo", sort: "operational_deadline" },
  { k: "fin", l: "Situação financeira" }, { k: "orig", l: "Origem" }, { k: "upd", l: "Última atualização", sort: "updated_at" }, { k: "sync", l: "Sincronização" },
];
export const TabelaCobrancas = ({ rows, total, page, size, onAbrir }: { rows: Receivable[]; total: number; page: number; size: number; onAbrir: (id: string) => void }) => {
  const { get, set } = useUrlFiltros(); const sort = get("sort") || "competence", dir = get("dir") || "asc";
  const ordenar = (s?: string) => s && set({ sort: s, dir: sort === s && dir === "asc" ? "desc" : "asc" });
  const trunc = (v: string | null, w = "max-w-[180px]") => <span className={cn("block truncate", w)} title={v ?? ""}>{v ?? "—"}</span>;
  return (
    <div className="panel">
      <div className="panel-head"><span className="panel-title">Recebíveis <span className="num font-normal text-ink-faint">({total})</span></span><Button variant="outline" size="sm" onClick={() => exportarCsv(rows)}><Download size={13} /> Exportar CSV (página)</Button></div>
      {rows.length === 0 ? <EmptyState msg="Nenhum recebível para os filtros selecionados." /> : (
        <div className="max-h-[calc(100vh-330px)] overflow-auto">
          <Table><TableHeader><TableRow>{COLS.map((c) => <TableHead key={c.k} className={cn(c.num && "num", c.fix && "fix z-20!", c.sort && "cursor-pointer select-none")} onClick={() => ordenar(c.sort)}>{c.l}{sort === c.sort && (dir === "asc" ? <ArrowUp size={11} className="ml-1 inline" /> : <ArrowDown size={11} className="ml-1 inline" />)}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{rows.map((r) => (
            <TableRow key={r.id} className={cn("clicavel", r.is_overdue && "bg-danger-soft/40!", r.sync_status === "error" && "bg-danger-soft/60!")} onClick={() => onAbrir(r.id)}>
              <TableCell className="fix"><BadgeFase code={r.stage_code} color={r.stage_color} pending={r.stage_pending} /></TableCell>
              <TableCell className="fix left-[52px]!"><span className="inline-flex items-center gap-1">{fmtCompetencia(r.competence)}{r.legacy_consolidated && <BadgeConsolidado />}</span></TableCell>
              <TableCell>{r.hub}</TableCell><TableCell>{trunc(r.ministry_government, "max-w-[120px]")}</TableCell><TableCell>{trunc(r.institute, "max-w-[90px]")}</TableCell><TableCell>{trunc(r.foundation, "max-w-[90px]")}</TableCell>
              <TableCell><span className="flex max-w-[240px] items-center gap-1.5"><span className="truncate font-medium" title={r.project_name}>{r.project_name}</span>{r.provisional && <BadgeProvisorio />}</span></TableCell>
              <TableCell className="num">{fmtBRL(r.planned_project)}</TableCell><TableCell className="num">{fmtBRL(r.received_project)}</TableCell><TableCell className={cn("num", Number(r.balance_project) > 0.01 && "font-medium")}>{fmtBRL(r.balance_project)}</TableCell>
              <TableCell className="num">{fmtBRL(r.planned_innovatis)}</TableCell><TableCell className="num">{fmtBRL(r.received_innovatis)}</TableCell><TableCell className="num">{fmtBRL(r.balance_innovatis)}</TableCell>
              <TableCell>{trunc(r.collection_status_label, "max-w-[200px]")}</TableCell><TableCell>{trunc(r.reason)}</TableCell><TableCell>{trunc(r.action)}</TableCell><TableCell>{trunc(r.responsible_name, "max-w-[110px]")}</TableCell>
              <TableCell className={cn(r.deadline_overdue && "font-medium text-danger")}>{fmtData(r.operational_deadline)}</TableCell>
              <TableCell><BadgeFin s={r.overall_financial_status} /></TableCell><TableCell>{ORIGIN_LABEL[r.origin]}</TableCell><TableCell className="text-ink-muted">{fmtDataHora(r.updated_at)}</TableCell><TableCell><BadgeSync s={r.sync_status} erro={r.sync_error} /></TableCell>
            </TableRow>))}</TableBody></Table>
        </div>)}
      <Paginacao page={page} size={size} total={total} />
    </div>
  );
};
