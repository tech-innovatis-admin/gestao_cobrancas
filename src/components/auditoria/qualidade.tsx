"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { fmtCompetencia } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Erro } from "@/components/ui/basicos";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { resolverConflito } from "@/services/syncActions";
import type { QualityIssue } from "@/types/domain";

const PENDENTES = ["ID ausente", "ID duplicado", "Status fora do catálogo", "Responsável não cadastrado", "Saldo divergente do Sheets", "Saldo zerado com situação legada Aberto", "Registro provisório possivelmente duplicado"];

const ResolverConflitoDialog = ({ receivableId, aberto, onFechar }: { receivableId: string; aberto: boolean; onFechar: () => void }) => {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const resolver = (resolution: "keep_platform" | "keep_sheet") => {
    setErro(null);
    start(async () => {
      try {
        await resolverConflito(receivableId, resolution);
        setOk(true);
      } catch (e) {
        setErro((e as Error).message);
      }
    });
  };

  const fechar = () => { setErro(null); setOk(false); onFechar(); };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Resolver conflito de sincronização</DialogTitle></DialogHeader>
        {!ok ? (
          <div className="space-y-3 text-[13px]">
            <p className="text-ink-muted">Esta cobrança tem uma edição pendente na plataforma que diverge do que está atualmente na planilha. Escolha qual lado deve prevalecer — a outra versão será descartada.</p>
            <Erro msg={erro} />
            <div className="mt-2 flex flex-col gap-2">
              <Button variant="outline" onClick={() => resolver("keep_platform")} disabled={pending}>{pending ? "Resolvendo…" : "Manter dados da plataforma"}</Button>
              <Button variant="outline" onClick={() => resolver("keep_sheet")} disabled={pending}>{pending ? "Resolvendo…" : "Manter dados da planilha"}</Button>
            </div>
            <div className="mt-2 flex justify-end"><Button variant="ghost" onClick={fechar} disabled={pending}>Cancelar</Button></div>
          </div>
        ) : (
          <div className="space-y-3 text-[13px]">
            <p className="text-ok">Conflito resolvido.</p>
            <div className="flex justify-end"><Button onClick={fechar}>Fechar</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const LinhaQualidade = ({ i }: { i: QualityIssue }) => {
  const [aberto, setAberto] = useState(false);
  const destino = i.receivable_id ? `/cobrancas?receivable=${i.receivable_id}` : i.project_id ? `/cobrancas?q=${encodeURIComponent(i.project_name ?? "")}&status=all` : "/auditoria?tab=qualidade";
  return (
    <TableRow className="clicavel">
      <TableCell><Link href={destino} className="hover:text-action">{i.project_name ?? i.issue}</Link></TableCell>
      <TableCell>{i.competence ? fmtCompetencia(i.competence) : "—"}</TableCell>
      {i.issue === "sync_error" && (
        <TableCell>
          {i.receivable_id && (
            <>
              <Button size="xs" variant="outline" onClick={() => setAberto(true)}>Resolver conflito</Button>
              <ResolverConflitoDialog receivableId={i.receivable_id} aberto={aberto} onFechar={() => setAberto(false)} />
            </>
          )}
        </TableCell>
      )}
    </TableRow>
  );
};

export const Qualidade = ({ issues }: { issues: QualityIssue[] }) => {
  const grupos = new Map<string, QualityIssue[]>(); issues.forEach((i) => grupos.set(i.label, [...(grupos.get(i.label) ?? []), i]));
  return (
    <div className="space-y-3">
      <div className="panel px-4 py-3 text-[12px] text-ink-muted">Verificações dependentes da importação do Google Sheets (FASE 3): {PENDENTES.map((p) => <Badge key={p} variant="warn" className="mr-1">{p}</Badge>)}</div>
      {grupos.size === 0 ? <div className="panel px-4 py-8 text-center text-[13px] text-ink-faint">Nenhum problema detectado.</div> : [...grupos.entries()].map(([label, lista]) => (
        <div key={label} className="panel"><div className="panel-head"><span className="panel-title">{label}</span><Badge variant={lista.length > 0 ? "danger" : "ok"}>{lista.length}</Badge></div>
          <Table><TableBody>{lista.slice(0, 50).map((i, k) => <LinhaQualidade key={k} i={i} />)}</TableBody></Table>
          {lista.length > 50 && <p className="px-4 py-2 text-[11px] text-ink-faint">Mostrando 50 de {lista.length}.</p>}
        </div>))}
    </div>
  );
};
