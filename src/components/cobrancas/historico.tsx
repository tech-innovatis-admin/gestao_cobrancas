import Link from "next/link";
import { fmtDataHora } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACTION_LABEL, FIELD_LABEL, type AuditLog } from "@/types/domain";
const val = (v: unknown) => (v == null || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
export const Historico = ({ logs, master, projectName }: { logs: AuditLog[]; master: boolean; projectName: string }) => (
  <section>
    <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Histórico (últimas 5)</h3>
    {!master ? <p className="text-[12px] text-ink-faint">O histórico detalhado é visível ao Master Admin.</p> : logs.length === 0 ? <p className="text-[12px] text-ink-faint">Sem alterações registradas.</p> : (
      <Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Usuário</TableHead><TableHead>Campo</TableHead><TableHead>Antes</TableHead><TableHead>Depois</TableHead></TableRow></TableHeader><TableBody>
        {logs.flatMap((l) => (l.changed_fields.length ? l.changed_fields : ["—"]).map((c) => <TableRow key={`${l.id}-${c}`}><TableCell>{fmtDataHora(l.occurred_at)}</TableCell><TableCell>{l.actor_name ?? (l.source === "google_sheets" ? "Alteração externa" : "sistema")}</TableCell><TableCell>{c === "—" ? ACTION_LABEL[l.action_type] ?? l.action_type : FIELD_LABEL[c] ?? c}</TableCell><TableCell className="max-w-[120px] truncate text-ink-muted" title={val(l.before_data?.[c])}>{c === "—" ? "" : val(l.before_data?.[c])}</TableCell><TableCell className="max-w-[120px] truncate" title={val(l.after_data?.[c])}>{c === "—" ? "" : val(l.after_data?.[c])}</TableCell></TableRow>))}
      </TableBody></Table>)}
    {master && <Link href={`/auditoria?tab=alteracoes&projeto=${encodeURIComponent(projectName)}`} className="mt-2 inline-block text-[12px] text-action hover:underline">Ver auditoria completa</Link>}
  </section>
);
