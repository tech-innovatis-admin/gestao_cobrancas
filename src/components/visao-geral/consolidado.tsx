import { cn } from "@/lib/utils";
import { fmtBRL, fmtCompetencia, fmtPct } from "@/lib/format";
import type { LinhaConsolidado } from "@/services/dashboardService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
export const Consolidado = ({ linhas }: { linhas: LinhaConsolidado[] }) => (
  <div className="panel"><div className="panel-head"><span className="panel-title">Consolidado Mensal</span><span className="text-[11px] text-ink-faint">Mês × HUB × Tipo de valor · carteira ativa</span></div>
    <div className="max-h-[420px] overflow-auto"><Table><TableHeader><TableRow><TableHead>Mês</TableHead><TableHead>HUB</TableHead><TableHead>Tipo de Valor</TableHead><TableHead className="num">Previsto</TableHead><TableHead className="num">Recebido</TableHead><TableHead className="num">Saldo</TableHead><TableHead className="num">Batimento %</TableHead></TableRow></TableHeader><TableBody>
      {linhas.map((l, i) => <TableRow key={i} className={cn(l.tipo === "Innovatis" && "bg-ok-soft/50!", l.competence === "TOTAL" && "font-semibold border-t-2 border-navy/20")}><TableCell>{l.competence === "TOTAL" ? "TOTAL" : fmtCompetencia(l.competence)}</TableCell><TableCell>{l.hub}</TableCell><TableCell>{l.tipo}</TableCell><TableCell className="num">{fmtBRL(l.previsto)}</TableCell><TableCell className="num">{fmtBRL(l.recebido)}</TableCell><TableCell className={cn("num", l.saldo > 0.01 && "text-danger")}>{fmtBRL(l.saldo)}</TableCell><TableCell className="num">{fmtPct(l.recebido, l.previsto)}</TableCell></TableRow>)}
    </TableBody></Table></div></div>
);
