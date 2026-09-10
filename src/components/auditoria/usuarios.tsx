"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Erro } from "@/components/ui/basicos";
import { fmtDataHora } from "@/lib/format";
import { atualizarPerfilAction, criarUsuarioAction, resetarSenhaAction, type FormState } from "@/services/authActions";
import { ROLE_LABEL, type AppRole, type Profile } from "@/types/domain";

const PAPEIS = Object.entries(ROLE_LABEL) as [AppRole, string][];
export const Usuarios = ({ perfis, responsaveisLegados }: { perfis: Profile[]; responsaveisLegados: string[] }) => {
  const router = useRouter(); const [pending, start] = useTransition();
  const [modal, setModal] = useState<"novo" | "editar" | "senha" | null>(null); const [alvo, setAlvo] = useState<Profile | null>(null);
  const [erro, setErro] = useState<string | null>(null); const [ok, setOk] = useState<string | null>(null);
  const [novo, setNovo] = useState({ full_name: "", email: "", role: "viewer" as AppRole, senha_temporaria: "" });
  const [ed, setEd] = useState({ full_name: "", role: "viewer" as AppRole, active: true, legacy: "" });
  const [senha, setSenha] = useState("");
  const run = (fn: () => Promise<FormState>, msg: string) => start(async () => { const r = await fn(); if (r.erro) { setErro(r.erro); return; } setErro(null); setOk(msg); setModal(null); router.refresh(); });
  const abrirEditar = (p: Profile) => { setAlvo(p); setEd({ full_name: p.full_name, role: p.role, active: p.active, legacy: p.legacy_responsible_name ?? "" }); setErro(null); setModal("editar"); };
  const L = ({ t, children }: { t: string; children: React.ReactNode }) => <label className="lbl">{t}{children}</label>;
  return (<>
    <div className="panel">
      <div className="panel-head"><span className="panel-title">Usuários <span className="num font-normal text-ink-faint">({perfis.length})</span></span><Button size="sm" onClick={() => { setErro(null); setModal("novo"); }}>Criar usuário</Button></div>
      {ok && <p className="px-4 pt-2 text-[12px] text-ok">{ok}</p>}
      <Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Perfil</TableHead><TableHead>Ativo</TableHead><TableHead>Responsável legado</TableHead><TableHead>Último acesso</TableHead><TableHead>Troca de senha</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>
        {perfis.map((p) => <TableRow key={p.user_id}><TableCell className="font-medium">{p.full_name}</TableCell><TableCell>{p.email}</TableCell><TableCell><Badge variant={p.role === "master_admin" ? "info" : "secondary"}>{ROLE_LABEL[p.role]}</Badge></TableCell><TableCell>{p.active ? <Badge variant="ok">Ativo</Badge> : <Badge variant="danger">Inativo</Badge>}</TableCell><TableCell>{p.legacy_responsible_name ?? "—"}</TableCell><TableCell>{fmtDataHora(p.last_login_at)}</TableCell><TableCell>{p.must_change_password ? <Badge variant="warn">Pendente</Badge> : "—"}</TableCell>
          <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => abrirEditar(p)}>Editar</Button><Button size="sm" variant="ghost" onClick={() => { setAlvo(p); setSenha(""); setErro(null); setModal("senha"); }}>Resetar senha</Button></TableCell></TableRow>)}
      </TableBody></Table>
    </div>
    <Modal aberto={modal === "novo"} titulo="Criar usuário" onFechar={() => setModal(null)} largura="max-w-md">
      <div className="space-y-3">
        <L t="Nome"><input className="field mt-0.5" value={novo.full_name} onChange={(e) => setNovo({ ...novo, full_name: e.target.value })} /></L>
        <L t="E-mail"><input type="email" className="field mt-0.5" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} /></L>
        <L t="Perfil"><select className="field mt-0.5" value={novo.role} onChange={(e) => setNovo({ ...novo, role: e.target.value as AppRole })}>{PAPEIS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></L>
        <L t="Senha temporária (mín. 8)"><input type="text" className="field mt-0.5" value={novo.senha_temporaria} onChange={(e) => setNovo({ ...novo, senha_temporaria: e.target.value })} autoComplete="off" /></L>
        <p className="text-[11px] text-ink-faint">O usuário deverá trocar a senha no primeiro acesso. A senha temporária não será exibida novamente — copie-a agora.</p>
        <Erro msg={erro} /><div className="flex justify-end"><Button disabled={pending} onClick={() => run(() => criarUsuarioAction(novo), `Usuário ${novo.email} criado.`)}>Criar</Button></div>
      </div>
    </Modal>
    <Modal aberto={modal === "editar"} titulo={`Editar ${alvo?.full_name ?? ""}`} onFechar={() => setModal(null)} largura="max-w-md">
      <div className="space-y-3">
        <L t="Nome"><input className="field mt-0.5" value={ed.full_name} onChange={(e) => setEd({ ...ed, full_name: e.target.value })} /></L>
        <L t="Perfil"><select className="field mt-0.5" value={ed.role} onChange={(e) => setEd({ ...ed, role: e.target.value as AppRole })}>{PAPEIS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></L>
        <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" checked={ed.active} onChange={(e) => setEd({ ...ed, active: e.target.checked })} />Ativo</label>
        <L t="Vincular a responsável legado (texto da planilha)"><input list="legados" className="field mt-0.5" value={ed.legacy} onChange={(e) => setEd({ ...ed, legacy: e.target.value })} /><datalist id="legados">{responsaveisLegados.map((r) => <option key={r} value={r} />)}</datalist></L>
        <Erro msg={erro} /><div className="flex justify-end"><Button disabled={pending} onClick={() => alvo && run(() => atualizarPerfilAction({ user_id: alvo.user_id, role: ed.role, active: ed.active, full_name: ed.full_name, legacy_responsible_name: ed.legacy || null }), "Usuário atualizado.")}>Salvar</Button></div>
      </div>
    </Modal>
    <Modal aberto={modal === "senha"} titulo={`Resetar senha de ${alvo?.full_name ?? ""}`} onFechar={() => setModal(null)} largura="max-w-md">
      <div className="space-y-3"><L t="Nova senha temporária (mín. 8)"><input type="text" className="field mt-0.5" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="off" /></L><p className="text-[11px] text-ink-faint">O usuário será obrigado a trocar a senha no próximo login.</p><Erro msg={erro} /><div className="flex justify-end"><Button disabled={pending} onClick={() => alvo && run(() => resetarSenhaAction(alvo.user_id, senha), "Senha resetada.")}>Resetar</Button></div></div>
    </Modal>
  </>);
};
