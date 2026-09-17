"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, type Control, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Erro } from "@/components/ui/basicos";
import { fmtDataHora } from "@/lib/format";
import { atualizarPerfilAction, criarUsuarioAction, resetarSenhaAction, type FormState } from "@/services/authActions";
import { novoUsuarioSchema, atualizarPerfilSchema, resetarSenhaSchema, type NovoUsuarioInput, type AtualizarPerfilInput, type ResetarSenhaInput } from "@/lib/schemas/usuarios";
import { ROLE_LABEL, type AppRole, type Profile } from "@/types/domain";

const PAPEIS = Object.entries(ROLE_LABEL) as [AppRole, string][];

function CampoPerfil<T extends { role: AppRole }>({ control }: { control: Control<T> }) {
  return (
    <Controller control={control} name={"role" as Path<T>} render={({ field, fieldState }) => (
      <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Perfil</FieldLabel>
        <Select value={field.value as AppRole} onValueChange={(v: AppRole | null) => v && field.onChange(v)}><SelectTrigger id={field.name} className="w-full" aria-invalid={!!fieldState.error}><SelectValue>{(v: AppRole) => ROLE_LABEL[v]}</SelectValue></SelectTrigger><SelectContent>{PAPEIS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
        <FieldError errors={[fieldState.error]} /></Field>
    )} />
  );
}

export const Usuarios = ({ perfis, responsaveisLegados }: { perfis: Profile[]; responsaveisLegados: string[] }) => {
  const router = useRouter(); const [pending, start] = useTransition();
  const [modal, setModal] = useState<"novo" | "editar" | "senha" | null>(null); const [alvo, setAlvo] = useState<Profile | null>(null);
  const [erro, setErro] = useState<string | null>(null); const [ok, setOk] = useState<string | null>(null);
  const run = (fn: () => Promise<FormState>, msg: string) => start(async () => { const r = await fn(); if (r.erro) { setErro(r.erro); return; } setErro(null); setOk(msg); setModal(null); router.refresh(); });
  const abrirEditar = (p: Profile) => { setAlvo(p); setErro(null); setModal("editar"); };

  const novoForm = useForm<NovoUsuarioInput>({ resolver: zodResolver(novoUsuarioSchema), defaultValues: { full_name: "", email: "", role: "viewer", senha_temporaria: "" } });
  const editarForm = useForm<AtualizarPerfilInput>({ resolver: zodResolver(atualizarPerfilSchema) });
  const senhaForm = useForm<ResetarSenhaInput>({ resolver: zodResolver(resetarSenhaSchema), defaultValues: { senha_temporaria: "" } });

  const abrirNovo = () => { novoForm.reset({ full_name: "", email: "", role: "viewer", senha_temporaria: "" }); setErro(null); setModal("novo"); };
  const abrirEditarComReset = (p: Profile) => { editarForm.reset({ user_id: p.user_id, full_name: p.full_name, role: p.role, active: p.active, legacy_responsible_name: p.legacy_responsible_name ?? null }); abrirEditar(p); };
  const abrirSenha = (p: Profile) => { senhaForm.reset({ senha_temporaria: "" }); setAlvo(p); setErro(null); setModal("senha"); };

  return (<>
    <div className="panel">
      <div className="panel-head"><span className="panel-title">Usuários <span className="num font-normal text-ink-faint">({perfis.length})</span></span><Button size="sm" onClick={abrirNovo}>Criar usuário</Button></div>
      {ok && <p className="px-4 pt-2 text-[12px] text-ok">{ok}</p>}
      <Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Perfil</TableHead><TableHead>Ativo</TableHead><TableHead>Responsável legado</TableHead><TableHead>Último acesso</TableHead><TableHead>Troca de senha</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>
        {perfis.map((p) => <TableRow key={p.user_id}><TableCell className="font-medium">{p.full_name}</TableCell><TableCell>{p.email}</TableCell><TableCell><Badge variant={p.role === "master_admin" ? "info" : "secondary"}>{ROLE_LABEL[p.role]}</Badge></TableCell><TableCell>{p.active ? <Badge variant="ok">Ativo</Badge> : <Badge variant="danger">Inativo</Badge>}</TableCell><TableCell>{p.legacy_responsible_name ?? "—"}</TableCell><TableCell>{fmtDataHora(p.last_login_at)}</TableCell><TableCell>{p.must_change_password ? <Badge variant="warn">Pendente</Badge> : "—"}</TableCell>
          <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => abrirEditarComReset(p)}>Editar</Button><Button size="sm" variant="ghost" onClick={() => abrirSenha(p)}>Resetar senha</Button></TableCell></TableRow>)}
      </TableBody></Table>
    </div>

    <Dialog open={modal === "novo"} onOpenChange={(o) => !o && setModal(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Criar usuário</DialogTitle></DialogHeader>
        <form onSubmit={novoForm.handleSubmit((data) => run(() => criarUsuarioAction(data), `Usuário ${data.email} criado.`))}>
          <FieldGroup>
            <Controller control={novoForm.control} name="full_name" render={({ field, fieldState }) => (
              <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Nome</FieldLabel><Input id={field.name} {...field} aria-invalid={!!fieldState.error} /><FieldError errors={[fieldState.error]} /></Field>
            )} />
            <Controller control={novoForm.control} name="email" render={({ field, fieldState }) => (
              <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>E-mail</FieldLabel><Input id={field.name} type="email" {...field} aria-invalid={!!fieldState.error} /><FieldError errors={[fieldState.error]} /></Field>
            )} />
            <CampoPerfil control={novoForm.control} />
            <Controller control={novoForm.control} name="senha_temporaria" render={({ field, fieldState }) => (
              <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Senha temporária (mín. 8)</FieldLabel><Input id={field.name} type="text" autoComplete="off" {...field} aria-invalid={!!fieldState.error} /><FieldError errors={[fieldState.error]} /></Field>
            )} />
            <p className="text-[11px] text-ink-faint">O usuário deverá trocar a senha no primeiro acesso. A senha temporária não será exibida novamente — copie-a agora.</p>
            <Erro msg={erro} /><div className="flex justify-end"><Button type="submit" disabled={pending}>Criar</Button></div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={modal === "editar"} onOpenChange={(o) => !o && setModal(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Editar {alvo?.full_name ?? ""}</DialogTitle></DialogHeader>
        <form onSubmit={editarForm.handleSubmit((data) => run(() => atualizarPerfilAction(data), "Usuário atualizado."))}>
          <FieldGroup>
            <Controller control={editarForm.control} name="full_name" render={({ field, fieldState }) => (
              <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Nome</FieldLabel><Input id={field.name} {...field} aria-invalid={!!fieldState.error} /><FieldError errors={[fieldState.error]} /></Field>
            )} />
            <CampoPerfil control={editarForm.control} />
            <Controller control={editarForm.control} name="active" render={({ field }) => (
              <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />Ativo</label>
            )} />
            <Controller control={editarForm.control} name="legacy_responsible_name" render={({ field, fieldState }) => (
              <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Vincular a responsável legado (texto da planilha)</FieldLabel>
                <Input id={field.name} name={field.name} ref={field.ref} onBlur={field.onBlur} list="legados" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} aria-invalid={!!fieldState.error} /><datalist id="legados">{responsaveisLegados.map((r) => <option key={r} value={r} />)}</datalist>
                <FieldError errors={[fieldState.error]} /></Field>
            )} />
            <Erro msg={erro} /><div className="flex justify-end"><Button type="submit" disabled={pending}>Salvar</Button></div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={modal === "senha"} onOpenChange={(o) => !o && setModal(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Resetar senha de {alvo?.full_name ?? ""}</DialogTitle></DialogHeader>
        <form onSubmit={senhaForm.handleSubmit((data) => alvo && run(() => resetarSenhaAction(alvo.user_id, data.senha_temporaria), "Senha resetada."))}>
          <FieldGroup>
            <Controller control={senhaForm.control} name="senha_temporaria" render={({ field, fieldState }) => (
              <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Nova senha temporária (mín. 8)</FieldLabel><Input id={field.name} type="text" autoComplete="off" {...field} aria-invalid={!!fieldState.error} /><FieldError errors={[fieldState.error]} /></Field>
            )} />
            <p className="text-[11px] text-ink-faint">O usuário será obrigado a trocar a senha no próximo login.</p>
            <Erro msg={erro} /><div className="flex justify-end"><Button type="submit" disabled={pending}>Resetar</Button></div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  </>);
};
