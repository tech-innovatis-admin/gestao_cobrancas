"use client";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { BadgeConsolidado, BadgeFase, BadgeFin, BadgeProvisorio, BadgeSituacao, BadgeSync } from "@/components/ui/badges-dominio";
import { FormOperacional } from "./form-operacional";
import { AcoesMaster } from "./acoes-master";
import { Historico } from "./historico";
import { fmtBRL, fmtCompetenciaLonga, fmtData } from "@/lib/format";
import { ORIGIN_LABEL, type AuditLog, type CollectionStatus, type Profile, type Receivable } from "@/types/domain";

export interface DrawerProps { r: Receivable | null; etapas: CollectionStatus[]; perfis: Profile[]; perfil: Profile; historico: AuditLog[] }
const Campo = ({ t, children }: { t: string; children: React.ReactNode }) => <div><div className="text-[11px] text-ink-faint">{t}</div><div className="text-[13px]">{children}</div></div>;
const Fin = ({ t, prev, rec, saldo, st }: { t: string; prev: number; rec: number; saldo: number; st: Receivable["overall_financial_status"] }) => (
  <div className="rounded border border-line p-2.5"><div className="mb-1 flex items-center justify-between text-[12px] font-semibold">{t}<BadgeFin s={st} /></div>
    <div className="grid grid-cols-3 gap-2 text-[12px]"><div className="text-ink-faint">Previsto<div className="num text-ink">{fmtBRL(prev)}</div></div><div className="text-ink-faint">Recebido<div className="num text-ok">{fmtBRL(rec)}</div></div><div className="text-ink-faint">Saldo<div className={`num ${saldo > 0.01 ? "text-danger" : "text-ink"}`}>{fmtBRL(saldo)}</div></div></div></div>
);

export const DrawerCobranca = ({ r, etapas, perfis, perfil, historico }: DrawerProps) => {
  const router = useRouter();
  const fechar = () => { const u = new URL(window.location.href); u.searchParams.delete("receivable"); router.push(u.pathname + u.search); };
  const master = perfil.role === "master_admin";
  const podeEditar = (master || perfil.role === "operator") && !!r?.project_active && r.project_status !== "archived";
  return (
    <Sheet open={!!r} onOpenChange={(open) => !open && fechar()}>
      <SheetContent className="w-full gap-0 sm:max-w-[640px]!">
        {r && (<>
          <SheetHeader className="border-b border-line">
            <SheetTitle>{r.project_name}</SheetTitle>
            <SheetDescription>{fmtCompetenciaLonga(r.competence)} · {r.hub}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
            <section><h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Identificação</h3>
              <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                <Campo t="ID Cobrança"><code className="text-[11px]">{r.id}</code></Campo>
                <Campo t="Competência"><span className="inline-flex items-center gap-1">{fmtCompetenciaLonga(r.competence)}{r.legacy_consolidated && <BadgeConsolidado />}</span></Campo>
                <Campo t="Fase"><BadgeFase code={r.stage_code} color={r.stage_color} pending={r.stage_pending} /> <span className="text-[11px] text-ink-faint">{r.stage_name}</span></Campo>
                <Campo t="Situação"><BadgeSituacao s={r.project_status} /></Campo><Campo t="HUB">{r.hub}</Campo><Campo t="Ministério / Governo">{r.ministry_government ?? "—"}</Campo>
                <Campo t="Instituto">{r.institute ?? "—"}</Campo><Campo t="Fundação">{r.foundation ?? "—"}</Campo><Campo t="Origem">{ORIGIN_LABEL[r.origin]}</Campo>
                <Campo t="Provisório">{r.provisional ? <BadgeProvisorio /> : "Não"}</Campo><Campo t="Sincronização"><BadgeSync s={r.sync_status} erro={r.sync_error} /> <span className="text-[11px] text-ink-faint">v{r.source_version}</span></Campo><Campo t="FLAG">{r.flag ?? "—"}</Campo>
              </div>
              {r.legacy_consolidated && <p className="mt-2 rounded border border-line bg-canvas p-2 text-[11.5px] text-ink-muted">Julho/2026 contém cobranças consolidadas de competências vencidas até junho/2026.</p>}
              {r.project_status === "archived" && <p className="mt-2 rounded border border-line bg-canvas p-2 text-[11.5px] text-ink-muted">Excluído da gestão em {fmtData(r.archived_at)}: {r.archive_reason}</p>}
            </section>
            <section><h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Financeiro</h3>
              <div className="grid grid-cols-2 gap-2"><Fin t="Projeto" prev={Number(r.planned_project)} rec={Number(r.received_project)} saldo={Number(r.balance_project)} st={r.project_financial_status} /><Fin t="Innovatis" prev={Number(r.planned_innovatis)} rec={Number(r.received_innovatis)} saldo={Number(r.balance_innovatis)} st={r.innovatis_financial_status} /></div>
              <div className="mt-2 flex items-center gap-2 text-[12px]">Situação geral: <BadgeFin s={r.overall_financial_status} />{r.received_exceeds_planned && <span className="badge b-orange">Recebido &gt; previsto</span>}{r.invoice_number && <span className="text-ink-faint">NF {r.invoice_number}</span>}{r.financial_received_date && <span className="text-ink-faint">recebido em {fmtData(r.financial_received_date)}</span>}</div>
            </section>
            <FormOperacional key={`${r.id}-${r.source_version}`} r={r} etapas={etapas} perfis={perfis} perfilAtual={perfil} podeEditar={podeEditar} onSalvo={() => router.refresh()} />
            {master && <AcoesMaster r={r} etapas={etapas} onFeito={() => router.refresh()} />}
            <Historico logs={historico} master={master} receivableId={r.id} />
          </div>
        </>)}
      </SheetContent>
    </Sheet>
  );
};
