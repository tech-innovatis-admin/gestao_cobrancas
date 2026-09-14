import Link from "next/link";
import { cn } from "@/lib/utils";
import { fmtBRL, fmtCompetencia, fmtData } from "@/lib/format";
import { BadgeFase } from "@/components/ui/badges-dominio";
import { EmptyState } from "@/components/ui/basicos";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Receivable } from "@/types/domain";
export const TabelaGerencial = ({ titulo, tom, rows, vazio }: { titulo: string; tom: "danger" | "ok"; rows: Receivable[]; vazio: string }) => (
  <div className="panel overflow-hidden">
    <div className={cn("flex items-center justify-between px-4 py-2 text-white", tom === "danger" ? "bg-danger" : "bg-ok")}><span className="text-[13px] font-semibold">{titulo}</span><span className="num text-[12px] opacity-90">{rows.length}</span></div>
    {rows.length === 0 ? <EmptyState msg={vazio} /> : <div className="max-h-[400px] overflow-auto"><Table><TableHeader><TableRow><TableHead>Mês</TableHead><TableHead>HUB</TableHead><TableHead>Fase</TableHead><TableHead>Projeto</TableHead><TableHead>Etapa</TableHead><TableHead>Responsável</TableHead><TableHead>Prazo</TableHead><TableHead className="num">Saldo Projeto</TableHead><TableHead className="num">Saldo Innovatis</TableHead></TableRow></TableHeader><TableBody>
      {rows.map((r) => <TableRow key={r.id} className="clicavel"><TableCell><Link href={`/cobrancas?receivable=${r.id}`} className="block">{fmtCompetencia(r.competence)}</Link></TableCell><TableCell>{r.hub}</TableCell><TableCell><BadgeFase code={r.stage_code} color={r.stage_color} pending={r.stage_pending} /></TableCell><TableCell className="max-w-[220px] truncate" title={r.project_name}><Link href={`/cobrancas?receivable=${r.id}`} className="hover:text-action">{r.project_name}</Link></TableCell><TableCell className="max-w-[200px] truncate" title={r.collection_status_label ?? ""}>{r.collection_status_label ?? "—"}</TableCell><TableCell>{r.responsible_name ?? "—"}</TableCell><TableCell className={cn(r.deadline_overdue && "text-danger font-medium")}>{fmtData(r.operational_deadline)}</TableCell><TableCell className="num">{fmtBRL(r.balance_project)}</TableCell><TableCell className="num">{fmtBRL(r.balance_innovatis)}</TableCell></TableRow>)}
    </TableBody></Table></div>}
  </div>
);
