"use client";
import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Erro, Pendente } from "@/components/ui/basicos";
import { fmtBRL, parseBRL } from "@/lib/format";
import { alterarFase, alterarSituacao, criarRecebivel, editarProjeto, excluirDaGestao, registrarRecebimento, restaurarProjeto, salvarFinanceiro, type Resultado } from "@/services/receivablesActions";
import { editarProjetoSchema, type EditarProjetoInput, alterarFaseSchema, type AlterarFaseInput, alterarSituacaoSchema, type AlterarSituacaoInput, financeiroFormSchema, type FinanceiroFormInput, reciboFormSchema, type ReciboFormInput, novaParcelaFormSchema, type NovaParcelaFormInput, motivoSchema, type MotivoInput } from "@/lib/schemas/receivables-admin";
import { ORIGIN_LABEL, type CollectionStatus, type Receivable } from "@/types/domain";

type Acao = "cadastro" | "fase" | "situacao" | "valores" | "recebimento" | "parcela" | "excluir" | "restaurar" | null;
const ORIGENS = Object.entries(ORIGIN_LABEL) as [Receivable["origin"], string][];

export const AcoesMaster = ({ r, etapas, onFeito }: { r: Receivable; etapas: CollectionStatus[]; onFeito: () => void }) => {
  const [acao, setAcao] = useState<Acao>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const exec = (fn: () => Promise<Resultado<unknown>>) => start(async () => { const res = await fn(); if (!res.ok) { setErro(res.erro); return; } setErro(null); setAcao(null); onFeito(); });
  const fechar = () => { setAcao(null); setErro(null); };
  const arquivado = !r.project_active;

  return (
    <section className="space-y-2">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Ações do Master Admin</h3>
      <div className="flex flex-wrap gap-1.5">
        {!arquivado && <>
          <Button size="sm" variant="outline" onClick={() => setAcao("cadastro")}>Editar cadastro</Button>
          <Button size="sm" variant="outline" onClick={() => setAcao("fase")}>Alterar Fase</Button>
          <Button size="sm" variant="outline" onClick={() => setAcao("situacao")}>Alterar Situação</Button>
          <Button size="sm" variant="outline" onClick={() => setAcao("valores")}>Editar valores</Button>
          <Button size="sm" variant="outline" onClick={() => setAcao("recebimento")}>Registrar recebimento</Button>
          <Button size="sm" variant="outline" onClick={() => setAcao("parcela")}>Criar nova parcela</Button>
          <Button size="sm" variant="danger" onClick={() => setAcao("excluir")}>Excluir da gestão</Button>
        </>}
        {arquivado && <Button size="sm" onClick={() => setAcao("restaurar")}>Restaurar</Button>}
        <span title="Disponível após a importação da base financeira (FASE 3)"><Button size="sm" variant="ghost" disabled>Vincular a registro oficial</Button></span>
        <span title="Sincronização com Google Sheets: configuração pendente (FASE 3)"><Button size="sm" variant="ghost" disabled>Tentar sincronização novamente</Button></span>
      </div>
      <p className="text-[11px] text-ink-faint">Vincular e sincronizar: <Pendente /></p>

      <Dialog open={acao === "cadastro"} onOpenChange={(o) => !o && fechar()}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Editar cadastro do projeto</DialogTitle></DialogHeader><FormCadastro r={r} erro={erro} pending={pending} onSalvar={(d) => exec(() => editarProjeto(r.project_id, d))} /></DialogContent></Dialog>
      <Dialog open={acao === "fase"} onOpenChange={(o) => !o && fechar()}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Alterar Fase do projeto</DialogTitle></DialogHeader><FormFase atual={r.stage_code} erro={erro} pending={pending} onSalvar={(f, j) => exec(() => alterarFase(r.project_id, f, j))} /></DialogContent></Dialog>
      <Dialog open={acao === "situacao"} onOpenChange={(o) => !o && fechar()}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Alterar Situação do projeto</DialogTitle></DialogHeader><FormSituacao r={r} erro={erro} pending={pending} onSalvar={(s, j, f) => exec(() => alterarSituacao(r.project_id, s, j, f))} /></DialogContent></Dialog>
      <Dialog open={acao === "valores"} onOpenChange={(o) => !o && fechar()}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Editar valores</DialogTitle></DialogHeader><FormValores r={r} erro={erro} pending={pending} onSalvar={(d) => exec(() => salvarFinanceiro({ id: r.id, ...d }))} /></DialogContent></Dialog>
      <Dialog open={acao === "recebimento"} onOpenChange={(o) => !o && fechar()}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Registrar recebimento</DialogTitle></DialogHeader><FormRecebimento r={r} erro={erro} pending={pending} onSalvar={(d) => exec(() => registrarRecebimento({ id: r.id, ...d }))} /></DialogContent></Dialog>
      <Dialog open={acao === "parcela"} onOpenChange={(o) => !o && fechar()}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Nova parcela / recebível</DialogTitle></DialogHeader><FormParcela r={r} etapas={etapas} erro={erro} pending={pending} onSalvar={(d) => exec(() => criarRecebivel({ project_id: r.project_id, ...d }))} /></DialogContent></Dialog>
      <Dialog open={acao === "excluir"} onOpenChange={(o) => !o && fechar()}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Excluir da gestão</DialogTitle></DialogHeader><FormMotivo texto={`O projeto "${r.project_name}" e todos os seus recebíveis deixarão de aparecer em dashboards, totais, cobranças e filtros. O histórico é preservado e o projeto pode ser restaurado.`} rotulo="Confirmar exclusão" erro={erro} pending={pending} onSalvar={(m) => exec(() => excluirDaGestao(r.project_id, m))} danger /></DialogContent></Dialog>
      <Dialog open={acao === "restaurar"} onOpenChange={(o) => !o && fechar()}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Restaurar projeto</DialogTitle></DialogHeader><p className="text-[13px]">Restaurar &quot;{r.project_name}&quot; e seus recebíveis para a operação ativa?</p><Erro msg={erro} /><div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={fechar}>Cancelar</Button><Button disabled={pending} onClick={() => exec(() => restaurarProjeto(r.project_id))}>Restaurar</Button></div></DialogContent></Dialog>
    </section>
  );
};

const Rodape = ({ erro, pending, onSalvar, rotulo = "Salvar", danger }: { erro: string | null; pending: boolean; onSalvar: () => void; rotulo?: string; danger?: boolean }) => (<><Erro msg={erro} /><div className="mt-4 flex justify-end"><Button variant={danger ? "danger" : "primary"} disabled={pending} onClick={onSalvar}>{pending ? "Salvando…" : rotulo}</Button></div></>);
const L = ({ t, children, c }: { t: string; children: React.ReactNode; c?: string }) => <label className={`lbl ${c ?? ""}`}>{t}{children}</label>;

function FormCadastro({ r, erro, pending, onSalvar }: { r: Receivable; erro: string | null; pending: boolean; onSalvar: (d: EditarProjetoInput) => void }) {
  const form = useForm<EditarProjetoInput>({ resolver: zodResolver(editarProjetoSchema), defaultValues: { name: r.project_name, hub: r.hub, ministry_government: r.ministry_government ?? "", institute: r.institute ?? "", foundation: r.foundation ?? "", origin: r.project_origin, provisional: r.project_provisional, notes: "" } });
  return (
    <form onSubmit={form.handleSubmit(onSalvar)} className="grid grid-cols-2 gap-3">
      <Controller control={form.control} name="name" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error} className="col-span-2"><FieldLabel htmlFor={field.name}>Projeto</FieldLabel><Input id={field.name} aria-invalid={!!fieldState.error} {...field} /><FieldError errors={[fieldState.error]} /></Field>
      )} />
      <Controller control={form.control} name="hub" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>HUB</FieldLabel>
          <Select value={field.value} onValueChange={field.onChange}><SelectTrigger id={field.name} className="w-full" aria-invalid={!!fieldState.error}><SelectValue>{(v: string) => v}</SelectValue></SelectTrigger><SelectContent><SelectItem value="IFES">IFES</SelectItem><SelectItem value="GOV">GOV</SelectItem></SelectContent></Select>
          <FieldError errors={[fieldState.error]} /></Field>
      )} />
      <Controller control={form.control} name="ministry_government" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Ministério / Governo</FieldLabel><Input id={field.name} aria-invalid={!!fieldState.error} {...field} value={field.value ?? ""} /><FieldError errors={[fieldState.error]} /></Field>
      )} />
      <Controller control={form.control} name="institute" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Instituto</FieldLabel><Input id={field.name} aria-invalid={!!fieldState.error} {...field} value={field.value ?? ""} /><FieldError errors={[fieldState.error]} /></Field>
      )} />
      <Controller control={form.control} name="foundation" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Fundação</FieldLabel><Input id={field.name} aria-invalid={!!fieldState.error} {...field} value={field.value ?? ""} /><FieldError errors={[fieldState.error]} /></Field>
      )} />
      <Controller control={form.control} name="origin" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Origem</FieldLabel>
          <Select value={field.value} onValueChange={field.onChange}><SelectTrigger id={field.name} className="w-full" aria-invalid={!!fieldState.error}><SelectValue>{(v: keyof typeof ORIGIN_LABEL) => ORIGIN_LABEL[v]}</SelectValue></SelectTrigger><SelectContent>{ORIGENS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
          <FieldError errors={[fieldState.error]} /></Field>
      )} />
      <Controller control={form.control} name="provisional" render={({ field }) => (
        <label className="flex items-center gap-2 self-end pb-2 text-[12px]"><input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />Provisório (CRM / pré-base)</label>
      )} />
      <Controller control={form.control} name="notes" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error} className="col-span-2"><FieldLabel htmlFor={field.name}>Observação</FieldLabel><Textarea id={field.name} aria-invalid={!!fieldState.error} {...field} value={field.value ?? ""} /><FieldError errors={[fieldState.error]} /></Field>
      )} />
      <div className="col-span-2"><Erro msg={erro} /><div className="mt-4 flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button></div></div>
    </form>
  );
}
function FormFase({ atual, erro, pending, onSalvar }: { atual: string | null; erro: string | null; pending: boolean; onSalvar: (f: string, j: string | null) => void }) {
  const form = useForm<AlterarFaseInput>({ resolver: zodResolver(alterarFaseSchema), defaultValues: { stage_code: (atual ?? "A") as AlterarFaseInput["stage_code"], justification: "" } });
  const onValid = (d: AlterarFaseInput) => onSalvar(d.stage_code, d.justification || null);
  return (
    <form onSubmit={form.handleSubmit(onValid)} className="space-y-3">
      <p className="text-[12px] text-ink-muted">Fase atual: <b>{atual ?? "Pendente"}</b>. Não há exigência de progressão linear; a alteração é auditada.</p>
      <Controller control={form.control} name="stage_code" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Nova fase</FieldLabel>
          <Select value={field.value} onValueChange={field.onChange}><SelectTrigger id={field.name} className="w-full" aria-invalid={!!fieldState.error}><SelectValue>{(v: string) => v}</SelectValue></SelectTrigger><SelectContent>{["A", "B", "C", "D"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
          <FieldError errors={[fieldState.error]} /></Field>
      )} />
      <Controller control={form.control} name="justification" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Justificativa (opcional)</FieldLabel><Textarea id={field.name} aria-invalid={!!fieldState.error} {...field} value={field.value ?? ""} /><FieldError errors={[fieldState.error]} /></Field>
      )} />
      <Erro msg={erro} /><div className="mt-4 flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button></div>
    </form>
  );
}
function FormSituacao({ r, erro, pending, onSalvar }: { r: Receivable; erro: string | null; pending: boolean; onSalvar: (s: "active" | "backlog" | "lost", j: string | null, f: string | null) => void }) {
  const statusOriginal = r.project_status === "archived" ? "active" : r.project_status;
  const schema = alterarSituacaoSchema(r.project_status);
  const form = useForm<AlterarSituacaoInput>({ resolver: zodResolver(schema), defaultValues: { status: statusOriginal, justification: "", stage_code: r.stage_code ?? "" } });
  const status = form.watch("status");
  const reativandoPerdido = r.project_status === "lost" && status === "active";
  const onValid = (d: AlterarSituacaoInput) => onSalvar(d.status, d.justification || null, d.stage_code || null);
  return (
    <form onSubmit={form.handleSubmit(onValid)} className="space-y-3">
      <Controller control={form.control} name="status" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Situação</FieldLabel>
          <Select value={field.value} onValueChange={field.onChange}><SelectTrigger id={field.name} className="w-full" aria-invalid={!!fieldState.error}><SelectValue>{(v: "active" | "backlog" | "lost") => ({ active: "Ativo", backlog: "Backlog", lost: "Perdido" }[v])}</SelectValue></SelectTrigger><SelectContent><SelectItem value="active">Ativo</SelectItem><SelectItem value="backlog">Backlog</SelectItem><SelectItem value="lost">Perdido</SelectItem></SelectContent></Select>
          <FieldError errors={[fieldState.error]} /></Field>
      )} />
      {reativandoPerdido && <Controller control={form.control} name="stage_code" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Confirmar fase (obrigatório ao reativar um perdido)</FieldLabel>
          <Select value={field.value || "__nenhuma__"} onValueChange={(v) => field.onChange(v === "__nenhuma__" ? "" : v)}><SelectTrigger id={field.name} className="w-full" aria-invalid={!!fieldState.error}><SelectValue>{(v: string) => (v === "__nenhuma__" ? "—" : v)}</SelectValue></SelectTrigger><SelectContent><SelectItem value="__nenhuma__">—</SelectItem>{["A", "B", "C", "D"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
          <FieldError errors={[fieldState.error]} /></Field>
      )} />}
      <Controller control={form.control} name="justification" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>{reativandoPerdido ? "Justificativa (obrigatória)" : "Justificativa"}</FieldLabel><Textarea id={field.name} aria-invalid={!!fieldState.error} {...field} value={field.value ?? ""} /><FieldError errors={[fieldState.error]} /></Field>
      )} />
      <p className="text-[11px] text-ink-faint">A fase é preservada; Backlog e Perdido saem dos totais ativos, mas continuam consultáveis.</p>
      <Erro msg={erro} /><div className="mt-4 flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button></div>
    </form>
  );
}
const Num = ({ t, v, set }: { t: string; v: string; set: (s: string) => void }) => <L t={t}><input className="field num mt-0.5 text-right" value={v} onChange={(e) => set(e.target.value)} /></L>;
function FormValores({ r, erro, pending, onSalvar }: { r: Receivable; erro: string | null; pending: boolean; onSalvar: (d: { planned_project: number; planned_innovatis: number; received_project: number; received_innovatis: number; competence: string; flag: string | null; origin: Receivable["origin"]; provisional: boolean; legacy_consolidated: boolean; justification: string | null }) => void }) {
  const s = (n: number | string) => Number(n).toFixed(2).replace(".", ",");
  const [f, setF] = useState({ pp: s(r.planned_project), pi: s(r.planned_innovatis), rp: s(r.received_project), ri: s(r.received_innovatis), competence: r.competence, flag: r.flag ?? "", origin: r.origin, provisional: r.provisional, legacy_consolidated: r.legacy_consolidated, justification: "" });
  const up = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  return (<div className="grid grid-cols-2 gap-3">
    <Num t="Previsto Projeto" v={f.pp} set={up("pp")} /><Num t="Previsto Innovatis" v={f.pi} set={up("pi")} />
    <Num t="Recebido Projeto" v={f.rp} set={up("rp")} /><Num t="Recebido Innovatis" v={f.ri} set={up("ri")} />
    <L t="Competência (1º dia do mês)"><input type="date" className="field mt-0.5" value={f.competence} onChange={(e) => up("competence")(e.target.value)} /></L>
    <L t="FLAG"><input className="field mt-0.5" value={f.flag} onChange={(e) => up("flag")(e.target.value)} /></L>
    <L t="Origem"><select className="field mt-0.5" value={f.origin} onChange={(e) => up("origin")(e.target.value as Receivable["origin"])}>{ORIGENS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></L>
    <div className="flex flex-col gap-1 self-end pb-1 text-[12px]"><label className="flex items-center gap-2"><input type="checkbox" checked={f.provisional} onChange={(e) => up("provisional")(e.target.checked)} />Provisório</label><label className="flex items-center gap-2"><input type="checkbox" checked={f.legacy_consolidated} onChange={(e) => up("legacy_consolidated")(e.target.checked)} />Consolidado (vencidos até jun/2026)</label></div>
    <L t="Justificativa" c="col-span-2"><textarea className="field mt-0.5 h-14 py-1.5" value={f.justification} onChange={(e) => up("justification")(e.target.value)} /></L>
    <div className="col-span-2"><Rodape erro={erro} pending={pending} onSalvar={() => onSalvar({ planned_project: parseBRL(f.pp), planned_innovatis: parseBRL(f.pi), received_project: parseBRL(f.rp), received_innovatis: parseBRL(f.ri), competence: f.competence.slice(0, 8) + "01", flag: f.flag || null, origin: f.origin, provisional: f.provisional, legacy_consolidated: f.legacy_consolidated, justification: f.justification || null })} /></div>
  </div>);
}
function FormRecebimento({ r, erro, pending, onSalvar }: { r: Receivable; erro: string | null; pending: boolean; onSalvar: (d: { received_project: number; received_innovatis: number; received_date: string | null; invoice_number: string | null; note: string | null; justification: string | null }) => void }) {
  const [f, setF] = useState({ rp: Number(r.received_project).toFixed(2).replace(".", ","), ri: Number(r.received_innovatis).toFixed(2).replace(".", ","), data: "", nf: "", note: "", just: "", confirmar: false });
  const rp = parseBRL(f.rp), ri = parseBRL(f.ri);
  const excede = rp > Number(r.planned_project) + 0.01 || ri > Number(r.planned_innovatis) + 0.01;
  const saldoAntes = Number(r.balance_project) + Number(r.balance_innovatis);
  const saldoDepois = Math.max(Number(r.planned_project) - rp, 0) + Math.max(Number(r.planned_innovatis) - ri, 0);
  const up = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  return (<div className="space-y-3">
    <p className="text-[12px] text-ink-muted">Informe o valor <b>acumulado</b> recebido em cada perspectiva.</p>
    <div className="grid grid-cols-2 gap-3"><Num t={`Recebido Projeto (previsto ${fmtBRL(r.planned_project)})`} v={f.rp} set={up("rp")} /><Num t={`Recebido Innovatis (previsto ${fmtBRL(r.planned_innovatis)})`} v={f.ri} set={up("ri")} />
      <L t="Data do recebimento"><input type="date" className="field mt-0.5" value={f.data} onChange={(e) => up("data")(e.target.value)} /></L><L t="NF"><input className="field mt-0.5" value={f.nf} onChange={(e) => up("nf")(e.target.value)} /></L></div>
    <div className="grid grid-cols-3 gap-2 rounded border border-line bg-canvas p-2 text-[12px]"><div>Saldo antes<div className="num font-semibold">{fmtBRL(saldoAntes)}</div></div><div>Valor recebido (total)<div className="num font-semibold text-ok">{fmtBRL(rp + ri)}</div></div><div>Saldo depois<div className="num font-semibold">{fmtBRL(saldoDepois)}</div></div></div>
    {excede && <div className="rounded border border-warn/40 bg-warn-soft p-2 text-[12px] text-warn"><b>Atenção:</b> o recebido supera o previsto. O saldo não fica negativo; a inconsistência será sinalizada. Para continuar, justifique e confirme.<label className="mt-1 flex items-center gap-2"><input type="checkbox" checked={f.confirmar} onChange={(e) => up("confirmar")(e.target.checked)} />Confirmo que o valor está correto</label></div>}
    <L t="Observação"><input className="field mt-0.5" value={f.note} onChange={(e) => up("note")(e.target.value)} /></L>
    <L t={excede ? "Justificativa (obrigatória)" : "Justificativa (se correção)"}><textarea className="field mt-0.5 h-14 py-1.5" value={f.just} onChange={(e) => up("just")(e.target.value)} /></L>
    <Rodape erro={erro} pending={pending || (excede && !f.confirmar)} rotulo="Registrar" onSalvar={() => onSalvar({ received_project: rp, received_innovatis: ri, received_date: f.data || null, invoice_number: f.nf || null, note: f.note || null, justification: f.just || null })} /></div>);
}
function FormParcela({ r, etapas, erro, pending, onSalvar }: { r: Receivable; etapas: CollectionStatus[]; erro: string | null; pending: boolean; onSalvar: (d: Omit<Parameters<typeof criarRecebivel>[0], "project_id">) => void }) {
  const [f, setF] = useState({ competence: "", pp: "", pi: "", rp: "0", ri: "0", etapa: "", reason: "", action: "", deadline: "", flag: "", origin: "platform" as Receivable["origin"], provisional: r.project_provisional });
  const up = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  return (<div className="grid grid-cols-2 gap-3">
    <p className="col-span-2 text-[12px] text-ink-muted">Projeto: <b>{r.project_name}</b></p>
    <L t="Competência"><input type="month" className="field mt-0.5" value={f.competence} onChange={(e) => up("competence")(e.target.value)} /></L><L t="Etapa da cobrança"><select className="field mt-0.5" value={f.etapa} onChange={(e) => up("etapa")(e.target.value)}><option value="">—</option>{etapas.filter((e) => e.hub === r.hub).map((e) => <option key={e.id} value={e.id}>{e.display_label}</option>)}</select></L>
    <Num t="Previsto Projeto" v={f.pp} set={up("pp")} /><Num t="Previsto Innovatis" v={f.pi} set={up("pi")} /><Num t="Recebido Projeto" v={f.rp} set={up("rp")} /><Num t="Recebido Innovatis" v={f.ri} set={up("ri")} />
    <L t="Motivo"><input className="field mt-0.5" value={f.reason} onChange={(e) => up("reason")(e.target.value)} /></L><L t="Ação"><input className="field mt-0.5" value={f.action} onChange={(e) => up("action")(e.target.value)} /></L>
    <L t="Prazo"><input type="date" className="field mt-0.5" value={f.deadline} onChange={(e) => up("deadline")(e.target.value)} /></L><L t="FLAG"><input className="field mt-0.5" value={f.flag} onChange={(e) => up("flag")(e.target.value)} /></L>
    <L t="Origem"><select className="field mt-0.5" value={f.origin} onChange={(e) => up("origin")(e.target.value as Receivable["origin"])}>{ORIGENS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></L>
    <label className="flex items-center gap-2 self-end pb-2 text-[12px]"><input type="checkbox" checked={f.provisional} onChange={(e) => up("provisional")(e.target.checked)} />Provisório</label>
    <div className="col-span-2"><Rodape erro={erro} pending={pending} rotulo="Criar" onSalvar={() => onSalvar({ competence: `${f.competence}-01`, planned_project: parseBRL(f.pp), planned_innovatis: parseBRL(f.pi), received_project: parseBRL(f.rp), received_innovatis: parseBRL(f.ri), collection_status_id: f.etapa || null, reason: f.reason || null, action: f.action || null, responsible_user_id: null, responsible_legacy_name: null, operational_deadline: f.deadline || null, flag: f.flag || null, origin: f.origin, provisional: f.provisional })} /></div>
  </div>);
}
function FormMotivo({ texto, rotulo, erro, pending, onSalvar, danger }: { texto: string; rotulo: string; erro: string | null; pending: boolean; onSalvar: (m: string) => void; danger?: boolean }) {
  const [m, setM] = useState("");
  return (<div className="space-y-3"><p className="text-[13px]">{texto}</p><L t="Motivo (obrigatório)"><textarea className="field mt-0.5 h-16 py-1.5" value={m} onChange={(e) => setM(e.target.value)} /></L><Rodape erro={erro} pending={pending || !m.trim()} rotulo={rotulo} danger={danger} onSalvar={() => onSalvar(m)} /></div>);
}
