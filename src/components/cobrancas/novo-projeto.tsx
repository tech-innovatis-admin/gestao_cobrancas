"use client";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Erro } from "@/components/ui/basicos";
import { criarProjeto, projetoSchema, type ProjetoInput } from "@/services/receivablesActions";
import { ORIGIN_LABEL, STATUS_LABEL } from "@/types/domain";

const FASES = ["A", "B", "C", "D"] as const;

export const NovoProjeto = () => {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const form = useForm<ProjetoInput>({ resolver: zodResolver(projetoSchema), defaultValues: { name: "", stage_code: "A", project_status: "active", hub: "IFES", ministry_government: "", institute: "", foundation: "", origin: "crm", provisional: true, notes: "" } });

  const onValid = (f: ProjetoInput) => start(async () => {
    const r = await criarProjeto({ ...f, ministry_government: f.ministry_government || null, institute: f.institute || null, foundation: f.foundation || null, notes: f.notes || null });
    if (!r.ok) { setErro(r.erro); return; }
    setErro(null); setAberto(false); form.reset();
  });

  return (<>
    <Button size="sm" onClick={() => setAberto(true)}><Plus size={13} /> Novo projeto</Button>
    <Modal aberto={aberto} titulo="Cadastrar projeto" onFechar={() => setAberto(false)}>
      <form onSubmit={form.handleSubmit(onValid)}>
        <FieldGroup className="grid grid-cols-2 gap-3">
          <Controller control={form.control} name="name" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error} className="col-span-2"><FieldLabel htmlFor={field.name}>Projeto</FieldLabel><Input id={field.name} aria-invalid={!!fieldState.error} {...field} /><FieldError errors={[fieldState.error]} /></Field>
          )} />
          <Controller control={form.control} name="stage_code" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Fase do projeto</FieldLabel>
              <Select value={field.value ?? "__pendente__"} onValueChange={(v) => field.onChange(v === "__pendente__" ? null : v)}>
                <SelectTrigger id={field.name} className="w-full" aria-invalid={!!fieldState.error}><SelectValue>{(v: string) => (v === "__pendente__" ? "Pendente" : v)}</SelectValue></SelectTrigger>
                <SelectContent>{FASES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}<SelectItem value="__pendente__">Pendente</SelectItem></SelectContent>
              </Select>
              <FieldError errors={[fieldState.error]} /></Field>
          )} />
          <Controller control={form.control} name="project_status" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Situação</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={field.name} className="w-full" aria-invalid={!!fieldState.error}><SelectValue>{(v: keyof typeof STATUS_LABEL) => STATUS_LABEL[v]}</SelectValue></SelectTrigger>
                <SelectContent>{(["active", "backlog", "lost"] as const).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
              </Select>
              <FieldError errors={[fieldState.error]} /></Field>
          )} />
          <Controller control={form.control} name="hub" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>HUB</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={field.name} className="w-full" aria-invalid={!!fieldState.error}><SelectValue>{(v: string) => v}</SelectValue></SelectTrigger>
                <SelectContent><SelectItem value="IFES">IFES</SelectItem><SelectItem value="GOV">GOV</SelectItem></SelectContent>
              </Select>
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
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={field.name} className="w-full" aria-invalid={!!fieldState.error}><SelectValue>{(v: keyof typeof ORIGIN_LABEL) => ORIGIN_LABEL[v]}</SelectValue></SelectTrigger>
                <SelectContent>{Object.entries(ORIGIN_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
              <FieldError errors={[fieldState.error]} /></Field>
          )} />
          <Controller control={form.control} name="provisional" render={({ field }) => (
            <label className="flex items-center gap-2 self-end pb-2 text-[12px]"><input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />Provisório (CRM / pré-base)</label>
          )} />
          <Controller control={form.control} name="notes" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error} className="col-span-2"><FieldLabel htmlFor={field.name}>Observação</FieldLabel><Textarea id={field.name} aria-invalid={!!fieldState.error} {...field} value={field.value ?? ""} /><FieldError errors={[fieldState.error]} /></Field>
          )} />
        </FieldGroup>
        <p className="mt-2 text-[11px] text-ink-faint">Após criar o projeto, abra qualquer recebível dele (ou use &quot;Criar nova parcela&quot;) para cadastrar as competências previstas.</p>
        <Erro msg={erro} /><div className="mt-4 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setAberto(false)}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? "Criando…" : "Criar projeto"}</Button></div>
      </form>
    </Modal>
  </>);
};
