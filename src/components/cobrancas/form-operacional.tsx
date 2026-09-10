"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Erro } from "@/components/ui/basicos";
import { fmtData, fmtDataHora } from "@/lib/format";
import { salvarOperacional, type ConflitoInfo } from "@/services/receivablesActions";
import type { CollectionStatus, Profile, Receivable } from "@/types/domain";

interface Valores { collection_status_id: string; responsible_user_id: string; responsible_legacy_name: string; operational_deadline: string; reason: string; action: string }
const deRecebivel = (r: Receivable): Valores => ({ collection_status_id: r.collection_status_id ?? "", responsible_user_id: r.responsible_user_id ?? "", responsible_legacy_name: r.responsible_legacy_name ?? "", operational_deadline: r.operational_deadline ?? "", reason: r.reason ?? "", action: r.action ?? "" });

export const FormOperacional = ({ r, etapas, perfis, perfilAtual, podeEditar, onSalvo }: { r: Receivable; etapas: CollectionStatus[]; perfis: Profile[]; perfilAtual: Profile; podeEditar: boolean; onSalvo: () => void }) => {
  const original = deRecebivel(r);
  const [v, setV] = useState<Valores>(original);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conflito, setConflito] = useState<ConflitoInfo | null>(null);
  const [registrado, setRegistrado] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof Valores>(k: K) => (val: Valores[K]) => setV((s) => ({ ...s, [k]: val }));

  const rotEtapa = (id: string) => etapas.find((e) => e.id === id)?.display_label ?? "—";
  const rotResp = (id: string, legado: string) => perfis.find((p) => p.user_id === id)?.full_name ?? legado ?? "—";
  const diffs: { campo: string; antes: string; depois: string }[] = [];
  if (v.collection_status_id !== original.collection_status_id) diffs.push({ campo: "Etapa da cobrança", antes: rotEtapa(original.collection_status_id), depois: rotEtapa(v.collection_status_id) });
  if (v.responsible_user_id !== original.responsible_user_id || v.responsible_legacy_name !== original.responsible_legacy_name) diffs.push({ campo: "Responsável", antes: rotResp(original.responsible_user_id, original.responsible_legacy_name), depois: rotResp(v.responsible_user_id, v.responsible_legacy_name) });
  if (v.operational_deadline !== original.operational_deadline) diffs.push({ campo: "Prazo", antes: fmtData(original.operational_deadline), depois: fmtData(v.operational_deadline) });
  if (v.reason !== original.reason) diffs.push({ campo: "Motivo", antes: original.reason || "—", depois: v.reason || "—" });
  if (v.action !== original.action) diffs.push({ campo: "Ação", antes: original.action || "—", depois: v.action || "—" });

  const salvar = () => start(async () => {
    const res = await salvarOperacional({ id: r.id, expected_version: r.source_version, collection_status_id: v.collection_status_id || null, responsible_user_id: v.responsible_user_id || null, responsible_legacy_name: v.responsible_user_id ? null : (v.responsible_legacy_name || null), operational_deadline: v.operational_deadline || null, reason: v.reason || null, action: v.action || null });
    setConfirmando(false);
    if (!res.ok) { setErro(res.erro); if (res.conflito) setConflito(res.conflito); return; }
    setErro(null); setRegistrado(`Atualização registrada por ${perfilAtual.full_name} em ${fmtDataHora(new Date().toISOString())}.`); onSalvo();
  });
  const opcoesHub = etapas.filter((e) => e.hub === r.hub);
  const SEM_ETAPA = "__sem-etapa__", SEM_RESP = "__sem-responsavel__";

  return (
    <section className="space-y-3">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Acompanhamento operacional</h3>
      <div className="flex flex-col gap-0.5">
        <Label>Etapa da cobrança</Label>
        <Select value={v.collection_status_id || SEM_ETAPA} onValueChange={(val) => set("collection_status_id")(!val || val === SEM_ETAPA ? "" : val)} disabled={!podeEditar}>
          <SelectTrigger className="w-full"><SelectValue>{(val: string) => (val === SEM_ETAPA ? "—" : opcoesHub.find((e) => e.id === val)?.display_label ?? val)}</SelectValue></SelectTrigger>
          <SelectContent><SelectItem value={SEM_ETAPA}>—</SelectItem>{opcoesHub.map((e) => <SelectItem key={e.id} value={e.id}>{e.display_label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5">
          <Label>Responsável (usuário)</Label>
          <Select value={v.responsible_user_id || SEM_RESP} onValueChange={(val) => set("responsible_user_id")(!val || val === SEM_RESP ? "" : val)} disabled={!podeEditar}>
            <SelectTrigger className="w-full"><SelectValue>{(val: string) => (val === SEM_RESP ? "— (usar nome livre)" : perfis.find((p) => p.user_id === val)?.full_name ?? val)}</SelectValue></SelectTrigger>
            <SelectContent><SelectItem value={SEM_RESP}>— (usar nome livre)</SelectItem>{perfis.filter((p) => p.active).map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-0.5">
          <Label>Responsável (nome livre)</Label>
          <Input value={v.responsible_legacy_name} onChange={(e) => set("responsible_legacy_name")(e.target.value)} disabled={!podeEditar || !!v.responsible_user_id} placeholder="Usado se nenhum usuário for selecionado" />
        </div>
      </div>
      <div className="flex flex-col gap-0.5 w-[160px]"><Label>Prazo</Label><Input type="date" value={v.operational_deadline} onChange={(e) => set("operational_deadline")(e.target.value)} disabled={!podeEditar} /></div>
      <div className="flex flex-col gap-0.5"><Label>Motivo</Label><Textarea className="h-16" value={v.reason} onChange={(e) => set("reason")(e.target.value)} disabled={!podeEditar} /></div>
      <div className="flex flex-col gap-0.5"><Label>Ação</Label><Textarea className="h-16" value={v.action} onChange={(e) => set("action")(e.target.value)} disabled={!podeEditar} /></div>

      {conflito && (
        <div className="rounded border border-danger/30 bg-danger-soft p-3 text-[12px]">
          <p className="font-semibold text-danger">Outra pessoa alterou este recebível enquanto você editava.</p>
          <p className="mt-1 text-ink-muted">Versão que você abriu: {r.source_version} · versão atual: {conflito.current_version} · atualizado em {fmtDataHora(String(conflito.current.updated_at))}.</p>
          <Table className="mt-2"><TableHeader><TableRow><TableHead>Campo</TableHead><TableHead>Você abriu</TableHead><TableHead>Atual no sistema</TableHead><TableHead>Você tentou salvar</TableHead></TableRow></TableHeader><TableBody>
            {[["Etapa", rotEtapa(original.collection_status_id), rotEtapa(String(conflito.current.collection_status_id ?? "")), rotEtapa(v.collection_status_id)], ["Prazo", fmtData(original.operational_deadline), fmtData(conflito.current.operational_deadline as string), fmtData(v.operational_deadline)], ["Motivo", original.reason || "—", String(conflito.current.reason ?? "—"), v.reason || "—"], ["Ação", original.action || "—", String(conflito.current.action ?? "—"), v.action || "—"]].map(([c, a, b, d]) => <TableRow key={c}><TableCell>{c}</TableCell><TableCell>{a}</TableCell><TableCell className="font-medium">{b}</TableCell><TableCell>{d}</TableCell></TableRow>)}
          </TableBody></Table>
          <div className="mt-2 flex gap-2"><Button size="sm" variant="outline" onClick={() => { setConflito(null); onSalvo(); }}>Recarregar com a versão atual</Button></div>
        </div>
      )}
      <Erro msg={erro} />
      {registrado && <p className="text-[12px] text-ok">{registrado}</p>}
      {podeEditar && !confirmando && <Button onClick={() => diffs.length ? setConfirmando(true) : setErro("Nenhum campo foi alterado.")} disabled={pending || !!conflito}>Salvar atualização</Button>}
      {confirmando && (
        <div className="rounded border border-line bg-canvas p-3">
          <p className="mb-2 text-[12px] font-semibold">Confirme as alterações</p>
          <Table><TableHeader><TableRow><TableHead>Campo</TableHead><TableHead>Antes</TableHead><TableHead>Depois</TableHead></TableRow></TableHeader><TableBody>{diffs.map((d) => <TableRow key={d.campo}><TableCell>{d.campo}</TableCell><TableCell className="whitespace-normal text-ink-muted">{d.antes}</TableCell><TableCell className="whitespace-normal font-medium">{d.depois}</TableCell></TableRow>)}</TableBody></Table>
          <div className="mt-3 flex gap-2"><Button onClick={salvar} disabled={pending}>{pending ? "Salvando…" : "Confirmar e salvar"}</Button><Button variant="outline" onClick={() => setConfirmando(false)}>Voltar</Button></div>
        </div>
      )}
    </section>
  );
};
