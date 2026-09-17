"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BadgeFase, BadgeFin, BadgeProvisorio, BadgeSituacao } from "@/components/ui/badges-dominio";
import { Consolidado } from "@/components/visao-geral/consolidado";
import type { LinhaConsolidado } from "@/services/dashboardService";
import { FormOperacional } from "./form-operacional";
import { AcoesProjeto, FormValores, FormRecebimento, FormParcela } from "./acoes-master";
import { Historico } from "./historico";
import { fmtBRL, fmtCompetencia, fmtData } from "@/lib/format";
import { criarRecebivel, registrarRecebimento, salvarFinanceiro, type Resultado } from "@/services/receivablesActions";
import { ORIGIN_LABEL, type AuditLog, type CollectionStatus, type Profile, type Project, type Receivable } from "@/types/domain";

const ABAS = [{ id: "geral", label: "Geral", master: false }, { id: "historico", label: "Histórico", master: true }] as const;
const Campo = ({ t, children }: { t: string; children: React.ReactNode }) => <div><div className="text-[11px] text-ink-faint">{t}</div><div className="text-[13px]">{children}</div></div>;

export interface DetalheProjetoProps { projeto: Project; recebiveis: Receivable[]; linhasConsolidado: LinhaConsolidado[]; etapas: CollectionStatus[]; perfis: Profile[]; perfil: Profile; historico: AuditLog[] }

export const DetalheProjeto = ({ projeto, recebiveis, linhasConsolidado, etapas, perfis, perfil, historico }: DetalheProjetoProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const aba = searchParams.get("aba") || "geral";
  const hrefAba = (id: string) => { const p = new URLSearchParams(searchParams.toString()); p.set("aba", id); return `${pathname}?${p.toString()}`; };
  const master = perfil.role === "master_admin";
  const podeEditar = (master || perfil.role === "operator") && projeto.active && projeto.project_status !== "archived";
  const atualizar = () => router.refresh();

  return (
    <Tabs value={aba}>
      <TabsList>
        {ABAS.filter((a) => !a.master || master).map((a) => (
          <TabsTrigger key={a.id} value={a.id} nativeButton={false} className="uppercase tracking-wide" render={<Link href={hrefAba(a.id)} scroll={false} />}>{a.label}</TabsTrigger>
        ))}
      </TabsList>
      <div className="mt-3 space-y-4">
        {aba === "geral" && (
          <div className="space-y-4">
            <section className="panel p-4"><h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Identificação</h3>
              <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                <Campo t="Fase"><BadgeFase code={projeto.stage_code} color={null} pending={projeto.stage_pending} /> <span className="text-[11px] text-ink-faint">{projeto.stage_name}</span></Campo>
                <Campo t="Situação"><BadgeSituacao s={projeto.project_status} /></Campo>
                <Campo t="HUB">{projeto.hub}</Campo>
                <Campo t="Ministério / Governo">{projeto.ministry_government ?? "—"}</Campo>
                <Campo t="Instituto">{projeto.institute ?? "—"}</Campo>
                <Campo t="Fundação">{projeto.foundation ?? "—"}</Campo>
                <Campo t="Origem">{ORIGIN_LABEL[projeto.origin]}</Campo>
                <Campo t="Provisório">{projeto.provisional ? <BadgeProvisorio /> : "Não"}</Campo>
                <Campo t="Criado em">{fmtData(projeto.created_at)}</Campo>
              </div>
              {projeto.notes && <p className="mt-2 rounded border border-line bg-canvas p-2 text-[11.5px] text-ink-muted">{projeto.notes}</p>}
              {projeto.project_status === "archived" && <p className="mt-2 rounded border border-line bg-canvas p-2 text-[11.5px] text-ink-muted">Excluído da gestão em {fmtData(projeto.archived_at)}: {projeto.archive_reason}</p>}
            </section>
            <Consolidado linhas={linhasConsolidado} />
            <AbaCobranca projeto={projeto} recebiveis={recebiveis} etapas={etapas} perfis={perfis} perfil={perfil} podeEditar={podeEditar} onSalvo={atualizar} />
            {master && <AcoesProjeto p={projeto} onFeito={atualizar} />}
          </div>
        )}
        {aba === "historico" && master && <Historico logs={historico} master={master} projectName={projeto.name} />}
      </div>
    </Tabs>
  );
};

type Edicao = { tipo: "operacional" | "valores" | "recebimento"; r: Receivable } | { tipo: "parcela" } | null;

const AbaCobranca = ({ projeto, recebiveis, etapas, perfis, perfil, podeEditar, onSalvo }: { projeto: Project; recebiveis: Receivable[]; etapas: CollectionStatus[]; perfis: Profile[]; perfil: Profile; podeEditar: boolean; onSalvo: () => void }) => {
  const [edicao, setEdicao] = useState<Edicao>(null);
  const [erro, setErro] = useState<string | null>(null);
  const master = perfil.role === "master_admin";
  const exec = async (fn: () => Promise<Resultado<unknown>>) => { const res = await fn(); if (!res.ok) { setErro(res.erro); return; } setErro(null); setEdicao(null); onSalvo(); };

  return (
    <div className="panel">
      <div className="panel-head"><span className="panel-title">Recebíveis do projeto <span className="num font-normal text-ink-faint">({recebiveis.length})</span></span>{master && <Button size="sm" onClick={() => setEdicao({ tipo: "parcela" })}>Criar nova parcela</Button>}</div>
      <Table><TableHeader><TableRow><TableHead>Competência</TableHead><TableHead>Etapa</TableHead><TableHead>Responsável</TableHead><TableHead>Prazo</TableHead><TableHead className="num">Saldo Projeto</TableHead><TableHead className="num">Saldo Innovatis</TableHead><TableHead>Situação</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
        <TableBody>{recebiveis.map((r) => (
          <TableRow key={r.id}>
            <TableCell>{fmtCompetencia(r.competence)}</TableCell>
            <TableCell>{r.collection_status_label ?? "—"}</TableCell>
            <TableCell>{r.responsible_name ?? "—"}</TableCell>
            <TableCell className={r.deadline_overdue ? "font-medium text-danger" : undefined}>{fmtData(r.operational_deadline)}</TableCell>
            <TableCell className="num">{fmtBRL(r.balance_project)}</TableCell>
            <TableCell className="num">{fmtBRL(r.balance_innovatis)}</TableCell>
            <TableCell><BadgeFin s={r.overall_financial_status} /></TableCell>
            <TableCell><div className="flex flex-wrap gap-1">
              <Button size="sm" variant="outline" onClick={() => setEdicao({ tipo: "operacional", r })}>Editar</Button>
              {master && <Button size="sm" variant="outline" onClick={() => setEdicao({ tipo: "valores", r })}>Valores</Button>}
              {master && <Button size="sm" variant="outline" onClick={() => setEdicao({ tipo: "recebimento", r })}>Recebimento</Button>}
            </div></TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>

      <Dialog open={edicao?.tipo === "operacional"} onOpenChange={(o) => !o && setEdicao(null)}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Acompanhamento operacional — {edicao?.tipo === "operacional" && fmtCompetencia(edicao.r.competence)}</DialogTitle></DialogHeader>
          {edicao?.tipo === "operacional" && <FormOperacional key={`${edicao.r.id}-${edicao.r.source_version}`} r={edicao.r} etapas={etapas} perfis={perfis} perfilAtual={perfil} podeEditar={podeEditar} onSalvo={() => { setEdicao(null); onSalvo(); }} />}
        </DialogContent>
      </Dialog>
      <Dialog open={edicao?.tipo === "valores"} onOpenChange={(o) => !o && setEdicao(null)}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Editar valores — {edicao?.tipo === "valores" && fmtCompetencia(edicao.r.competence)}</DialogTitle></DialogHeader>
          {edicao?.tipo === "valores" && <FormValores r={edicao.r} erro={erro} pending={false} onSalvar={(d) => exec(() => salvarFinanceiro({ id: (edicao as { r: Receivable }).r.id, ...d }))} />}
        </DialogContent>
      </Dialog>
      <Dialog open={edicao?.tipo === "recebimento"} onOpenChange={(o) => !o && setEdicao(null)}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Registrar recebimento — {edicao?.tipo === "recebimento" && fmtCompetencia(edicao.r.competence)}</DialogTitle></DialogHeader>
          {edicao?.tipo === "recebimento" && <FormRecebimento r={edicao.r} erro={erro} pending={false} onSalvar={(d) => exec(() => registrarRecebimento({ id: (edicao as { r: Receivable }).r.id, ...d }))} />}
        </DialogContent>
      </Dialog>
      <Dialog open={edicao?.tipo === "parcela"} onOpenChange={(o) => !o && setEdicao(null)}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Nova parcela / recebível</DialogTitle></DialogHeader>
          {edicao?.tipo === "parcela" && <FormParcela p={projeto} etapas={etapas} erro={erro} pending={false} onSalvar={(d) => exec(() => criarRecebivel({ project_id: projeto.id, ...d }))} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};
