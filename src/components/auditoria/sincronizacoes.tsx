"use client";
import { useState, useTransition } from "react";
import { Pendente, Erro } from "@/components/ui/basicos";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExecutarCargaInicial } from "@/components/auditoria/executar-carga-inicial";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDataHora } from "@/lib/format";
import { rodarSincronizacao, reprocessarFila, rodarReconciliacao, type ReconciliationResult } from "@/services/syncActions";
import type { SyncRun } from "@/types/domain";

const dur = (a: string, b: string | null) => (b ? `${Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000)}s` : "—");

export const Sincronizacoes = ({ runs, fila, fonte }: { runs: SyncRun[]; fila: number; fonte: { configured: boolean; healthy: boolean; message: string } }) => {
  const [pendingSync, startSync] = useTransition();
  const [pendingFila, startFila] = useTransition();
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const [reconciliarAberto, setReconciliarAberto] = useState(false);
  const [pendingReconciliar, startReconciliar] = useTransition();
  const [resultadoReconciliacao, setResultadoReconciliacao] = useState<ReconciliationResult | null>(null);
  const [erroReconciliacao, setErroReconciliacao] = useState<string | null>(null);

  const sincronizarAgora = () => {
    setErroAcao(null);
    startSync(async () => {
      try { await rodarSincronizacao(); }
      catch (e) { setErroAcao((e as Error).message); }
    });
  };

  const tentarNovamente = () => {
    setErroAcao(null);
    startFila(async () => {
      try { await reprocessarFila(); }
      catch (e) { setErroAcao((e as Error).message); }
    });
  };

  const abrirReconciliar = () => {
    setErroReconciliacao(null);
    setResultadoReconciliacao(null);
    setReconciliarAberto(true);
  };

  const confirmarReconciliar = () => {
    setErroReconciliacao(null);
    startReconciliar(async () => {
      try {
        const r = await rodarReconciliacao();
        setResultadoReconciliacao(r);
      } catch (e) {
        setErroReconciliacao((e as Error).message);
      }
    });
  };

  const fecharReconciliar = () => { setReconciliarAberto(false); setResultadoReconciliacao(null); setErroReconciliacao(null); };

  return (
    <div className="space-y-3">
      <div className="panel px-4 py-3">
        <div className="flex flex-wrap items-center gap-3 text-[13px]">
          <span className="font-semibold">Google Sheets</span>{fonte.configured ? <Badge variant={fonte.healthy ? "ok" : "danger"}>{fonte.healthy ? "Acessível" : "Erro"}</Badge> : <Pendente />}<span className="text-ink-muted">{fonte.message}</span>
          <span className="ml-auto text-ink-muted">Pendentes na fila: <b className="num">{fila}</b></span>
          <ExecutarCargaInicial />
          <Button size="sm" onClick={sincronizarAgora} disabled={pendingSync}>{pendingSync ? "Sincronizando…" : "Sincronizar agora"}</Button>
          <Button size="sm" variant="outline" onClick={tentarNovamente} disabled={pendingFila || fila === 0}>{pendingFila ? "Reprocessando…" : "Tentar novamente"}</Button>
          <Button size="sm" variant="outline" onClick={abrirReconciliar}>Reconciliar com Dashboard</Button>
        </div>
        <Erro msg={erroAcao} />
        <p className="mt-2 text-[11.5px] text-ink-faint">Sincronização, importação e write-back são implementados nas Edge Functions da FASE 3 (health-check, preview, initialize, import, synchronize, process-sync-queue, resolve-sync-conflict). Secrets necessários: <code>GOOGLE_SERVICE_ACCOUNT_JSON</code>, <code>GOOGLE_SPREADSHEET_ID</code>.</p>
      </div>
      <div className="panel"><div className="panel-head"><span className="panel-title">Execuções</span></div>
        {runs.length === 0 ? <p className="px-4 py-8 text-center text-[13px] text-ink-faint">Nenhuma sincronização executada.</p> : <Table><TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead>Início</TableHead><TableHead>Fim</TableHead><TableHead>Duração</TableHead><TableHead className="num">Lidos</TableHead><TableHead className="num">Criados</TableHead><TableHead className="num">Atualizados</TableHead><TableHead className="num">Ignorados</TableHead><TableHead className="num">Erros</TableHead><TableHead className="num">Conflitos</TableHead><TableHead>Erro</TableHead></TableRow></TableHeader><TableBody>
          {runs.map((r) => <TableRow key={r.id}><TableCell>{r.type}</TableCell><TableCell><Badge variant={r.status === "success" ? "ok" : r.status === "error" ? "danger" : "warn"}>{r.status}</Badge></TableCell><TableCell>{fmtDataHora(r.started_at)}</TableCell><TableCell>{fmtDataHora(r.finished_at)}</TableCell><TableCell>{dur(r.started_at, r.finished_at)}</TableCell><TableCell className="num">{r.records_read}</TableCell><TableCell className="num">{r.records_created}</TableCell><TableCell className="num">{r.records_updated}</TableCell><TableCell className="num">{r.records_ignored}</TableCell><TableCell className="num">{r.records_with_errors}</TableCell><TableCell className="num">{r.conflicts}</TableCell><TableCell className="max-w-[240px] truncate text-danger" title={r.error_message ?? ""}>{r.error_message ?? "—"}</TableCell></TableRow>)}
        </TableBody></Table>}
      </div>

      <Dialog open={reconciliarAberto} onOpenChange={(o) => !o && fecharReconciliar()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Reconciliar com Dashboard</DialogTitle></DialogHeader>
          {!resultadoReconciliacao && !erroReconciliacao && (
            <div className="space-y-3 text-[13px]">
              <p className="text-ink-muted">Compara os valores da planilha com os valores atuais no banco, sem alterar nada. Deseja continuar?</p>
              <Erro msg={erroReconciliacao} />
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={fecharReconciliar} disabled={pendingReconciliar}>Cancelar</Button>
                <Button onClick={confirmarReconciliar} disabled={pendingReconciliar}>{pendingReconciliar ? "Comparando…" : "Confirmar"}</Button>
              </div>
            </div>
          )}
          {resultadoReconciliacao && (
            <div className="space-y-3 text-[13px]">
              <div className="grid grid-cols-2 gap-2 rounded border border-line bg-canvas p-2">
                <div>Combinações comparadas<div className="num font-semibold">{resultadoReconciliacao.checked}</div></div>
                <div>Divergências<div className="num font-semibold text-danger">{resultadoReconciliacao.mismatches.length}</div></div>
              </div>
              {resultadoReconciliacao.mismatches.length === 0 ? (
                <p className="text-ink-muted">Nenhuma divergência encontrada.</p>
              ) : (
                <ul className="max-h-64 list-disc space-y-1 overflow-y-auto rounded border border-line bg-canvas p-2 pl-6 text-[12px]">
                  {resultadoReconciliacao.mismatches.map((m, i) => (
                    <li key={i}>
                      Competência {m.competence} · {m.hub} · {m.tipo}: previsto planilha = <b>{m.sheetPlanned.toFixed(2)}</b> / banco = <b>{m.dbPlanned.toFixed(2)}</b>; recebido planilha = <b>{m.sheetReceived.toFixed(2)}</b> / banco = <b>{m.dbReceived.toFixed(2)}</b>
                    </li>
                  ))}
                </ul>
              )}
              <Erro msg={erroReconciliacao} />
              <div className="mt-4 flex justify-end"><Button onClick={fecharReconciliar}>Fechar</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
