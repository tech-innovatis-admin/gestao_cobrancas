import { Pendente } from "@/components/ui/basicos";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDataHora } from "@/lib/format";
import type { SyncRun } from "@/types/domain";
const dur = (a: string, b: string | null) => (b ? `${Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000)}s` : "—");
export const Sincronizacoes = ({ runs, fila, fonte }: { runs: SyncRun[]; fila: number; fonte: { configured: boolean; healthy: boolean; message: string } }) => (
  <div className="space-y-3">
    <div className="panel px-4 py-3">
      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <span className="font-semibold">Google Sheets</span>{fonte.configured ? <Badge variant={fonte.healthy ? "ok" : "danger"}>{fonte.healthy ? "Acessível" : "Erro"}</Badge> : <Pendente />}<span className="text-ink-muted">{fonte.message}</span>
        <span className="ml-auto text-ink-muted">Pendentes na fila: <b className="num">{fila}</b></span>
        <Button size="sm" disabled>Sincronizar agora</Button><Button size="sm" variant="outline" disabled>Tentar novamente</Button>
      </div>
      <p className="mt-2 text-[11.5px] text-ink-faint">Sincronização, importação e write-back são implementados nas Edge Functions da FASE 3 (health-check, preview, initialize, import, synchronize, process-sync-queue, resolve-sync-conflict). Secrets necessários: <code>GOOGLE_SERVICE_ACCOUNT_JSON</code>, <code>GOOGLE_SPREADSHEET_ID</code>.</p>
    </div>
    <div className="panel"><div className="panel-head"><span className="panel-title">Execuções</span></div>
      {runs.length === 0 ? <p className="px-4 py-8 text-center text-[13px] text-ink-faint">Nenhuma sincronização executada.</p> : <Table><TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead>Início</TableHead><TableHead>Fim</TableHead><TableHead>Duração</TableHead><TableHead className="num">Lidos</TableHead><TableHead className="num">Criados</TableHead><TableHead className="num">Atualizados</TableHead><TableHead className="num">Ignorados</TableHead><TableHead className="num">Erros</TableHead><TableHead className="num">Conflitos</TableHead><TableHead>Erro</TableHead></TableRow></TableHeader><TableBody>
        {runs.map((r) => <TableRow key={r.id}><TableCell>{r.type}</TableCell><TableCell><Badge variant={r.status === "success" ? "ok" : r.status === "error" ? "danger" : "warn"}>{r.status}</Badge></TableCell><TableCell>{fmtDataHora(r.started_at)}</TableCell><TableCell>{fmtDataHora(r.finished_at)}</TableCell><TableCell>{dur(r.started_at, r.finished_at)}</TableCell><TableCell className="num">{r.records_read}</TableCell><TableCell className="num">{r.records_created}</TableCell><TableCell className="num">{r.records_updated}</TableCell><TableCell className="num">{r.records_ignored}</TableCell><TableCell className="num">{r.records_with_errors}</TableCell><TableCell className="num">{r.conflicts}</TableCell><TableCell className="max-w-[240px] truncate text-danger" title={r.error_message ?? ""}>{r.error_message ?? "—"}</TableCell></TableRow>)}
      </TableBody></Table>}
    </div>
  </div>
);
