import { cn } from "@/lib/utils";
import { fmtBRL, fmtCompetencia, fmtPct } from "@/lib/format";
import type { LinhaConsolidado } from "@/services/dashboardService";
export const Consolidado = ({ linhas }: { linhas: LinhaConsolidado[] }) => (
  <div className="panel"><div className="panel-head"><span className="panel-title">Consolidado Mensal</span><span className="text-[11px] text-ink-faint">Mês × HUB × Tipo de valor · carteira ativa</span></div>
    <div className="max-h-[420px] overflow-auto"><table className="tbl"><thead><tr><th>Mês</th><th>HUB</th><th>Tipo de Valor</th><th className="num">Previsto</th><th className="num">Recebido</th><th className="num">Saldo</th><th className="num">Batimento %</th></tr></thead><tbody>
      {linhas.map((l, i) => <tr key={i} className={cn(l.tipo === "Innovatis" && "bg-ok-soft/50!", l.competence === "TOTAL" && "font-semibold border-t-2 border-navy/20")}><td>{l.competence === "TOTAL" ? "TOTAL" : fmtCompetencia(l.competence)}</td><td>{l.hub}</td><td>{l.tipo}</td><td className="num">{fmtBRL(l.previsto)}</td><td className="num">{fmtBRL(l.recebido)}</td><td className={cn("num", l.saldo > 0.01 && "text-danger")}>{fmtBRL(l.saldo)}</td><td className="num">{fmtPct(l.recebido, l.previsto)}</td></tr>)}
    </tbody></table></div></div>
);
