import Link from "next/link";
import { fmtCompetencia } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { QualityIssue } from "@/types/domain";
const PENDENTES = ["ID ausente", "ID duplicado", "Status fora do catálogo", "Responsável não cadastrado", "Saldo divergente do Sheets", "Saldo zerado com situação legada Aberto", "Registro provisório possivelmente duplicado"];
export const Qualidade = ({ issues }: { issues: QualityIssue[] }) => {
  const grupos = new Map<string, QualityIssue[]>(); issues.forEach((i) => grupos.set(i.label, [...(grupos.get(i.label) ?? []), i]));
  return (
    <div className="space-y-3">
      <div className="panel px-4 py-3 text-[12px] text-ink-muted">Verificações dependentes da importação do Google Sheets (FASE 3): {PENDENTES.map((p) => <Badge key={p} variant="warn" className="mr-1">{p}</Badge>)}</div>
      {grupos.size === 0 ? <div className="panel px-4 py-8 text-center text-[13px] text-ink-faint">Nenhum problema detectado.</div> : [...grupos.entries()].map(([label, lista]) => (
        <div key={label} className="panel"><div className="panel-head"><span className="panel-title">{label}</span><Badge variant={lista.length > 0 ? "danger" : "ok"}>{lista.length}</Badge></div>
          <Table><TableBody>{lista.slice(0, 50).map((i, k) => <TableRow key={k} className="clicavel"><TableCell><Link href={i.receivable_id ? `/cobrancas?receivable=${i.receivable_id}` : i.project_id ? `/cobrancas?q=${encodeURIComponent(i.project_name ?? "")}&status=all` : "/auditoria?tab=qualidade"} className="hover:text-action">{i.project_name ?? i.issue}</Link></TableCell><TableCell>{i.competence ? fmtCompetencia(i.competence) : "—"}</TableCell></TableRow>)}</TableBody></Table>
          {lista.length > 50 && <p className="px-4 py-2 text-[11px] text-ink-faint">Mostrando 50 de {lista.length}.</p>}
        </div>))}
    </div>
  );
};
