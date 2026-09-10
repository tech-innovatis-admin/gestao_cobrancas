import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/basicos";
import { Alteracoes } from "@/components/auditoria/alteracoes";
import { Usuarios } from "@/components/auditoria/usuarios";
import { Sincronizacoes } from "@/components/auditoria/sincronizacoes";
import { Qualidade } from "@/components/auditoria/qualidade";
import { listarPerfis, perfilAtual } from "@/services/authService";
import { contarFila, listarAuditoria, listarQualidade, listarSyncRuns } from "@/services/auditService";
import { opcoesDeFiltro } from "@/services/receivablesService";
import { receivablesSource } from "@/integrations/receivables-source";

export const dynamic = "force-dynamic";
const TABS = [{ id: "alteracoes", label: "Alterações" }, { id: "usuarios", label: "Usuários" }, { id: "sincronizacoes", label: "Sincronizações" }, { id: "qualidade", label: "Qualidade dos dados" }];

export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const perfil = await perfilAtual();
  if (perfil.role !== "master_admin") redirect("/visao-geral"); // RLS também bloqueia audit_logs
  const sp = await searchParams; const tab = TABS.some((t) => t.id === sp.tab) ? sp.tab! : "alteracoes";
  return (<><Topbar titulo="Auditoria" perfil={perfil} /><main className="space-y-3 p-5">
    <Tabs value={tab}>
      <TabsList>
        {TABS.map((t) => (
          <TabsTrigger key={t.id} value={t.id} nativeButton={false} render={<Link href={`/auditoria?tab=${t.id}`} />}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
    <Suspense key={JSON.stringify(sp)} fallback={<Skeleton className="h-[480px]" />}>
      {tab === "alteracoes" && <TabAlteracoes sp={sp} />}{tab === "usuarios" && <TabUsuarios />}{tab === "sincronizacoes" && <TabSync />}{tab === "qualidade" && <TabQualidade />}
    </Suspense>
  </main></>);
}
async function TabAlteracoes({ sp }: { sp: Record<string, string | undefined> }) {
  const page = Number(sp.page ?? 1);
  const { rows, total } = await listarAuditoria({ de: sp.de, ate: sp.ate, usuario: sp.usuario, projeto: sp.projeto, campo: sp.campo, acao: sp.acao, origem: sp.origem, sync: sp.sync, page });
  const filtradas = sp.entity ? rows.filter((r) => r.entity_id === sp.entity) : rows;
  return <Alteracoes rows={filtradas} total={total} page={page} />;
}
async function TabUsuarios() { const [perfis, op] = await Promise.all([listarPerfis(), opcoesDeFiltro()]); return <Usuarios perfis={perfis} responsaveisLegados={op.responsaveis} />; }
async function TabSync() { const [runs, fila, fonte] = await Promise.all([listarSyncRuns(), contarFila(), receivablesSource.healthCheck()]); return <Sincronizacoes runs={runs} fila={fila} fonte={fonte} />; }
async function TabQualidade() { return <Qualidade issues={await listarQualidade()} />; }
