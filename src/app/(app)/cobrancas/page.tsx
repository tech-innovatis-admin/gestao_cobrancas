import { Suspense } from "react";
import { Topbar } from "@/components/layout/topbar";
import { FiltrosRapidos } from "@/components/cobrancas/filtros-rapidos";
import { FiltrosCobrancas } from "@/components/cobrancas/filtros-cobrancas";
import { ListaCobrancas } from "@/components/cobrancas/lista-cobrancas";
import { NovoProjeto } from "@/components/cobrancas/novo-projeto";
import { Skeleton } from "@/components/ui/basicos";
import { isMaster, perfilAtual } from "@/services/authService";
import { listarRecebiveis, opcoesDeFiltro } from "@/services/receivablesService";
import { listarEtapas } from "@/services/catalogService";
import { filtrosDaUrl, type SP } from "@/lib/filtros-url";

export const dynamic = "force-dynamic";
export default async function CobrancasPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams; const perfil = await perfilAtual();
  return (<><Topbar titulo="Cobranças" perfil={perfil} extra={isMaster(perfil) ? <NovoProjeto /> : undefined} /><main className="space-y-3 p-5">
    <FiltrosRapidos />
    <Suspense fallback={<Skeleton className="h-24" />}><FiltrosServer /></Suspense>
    <Suspense key={JSON.stringify(sp)} fallback={<Skeleton className="h-[480px]" />}><Lista sp={sp} /></Suspense>
  </main></>);
}
async function FiltrosServer() { const [op, etapas] = await Promise.all([opcoesDeFiltro(), listarEtapas()]); return <FiltrosCobrancas op={op} etapas={etapas} />; }
async function Lista({ sp }: { sp: SP }) {
  const perfil = await perfilAtual();
  const f = filtrosDaUrl(sp, perfil.user_id);
  const { rows, total } = await listarRecebiveis(f);
  return <ListaCobrancas rows={rows} total={total} page={f.page ?? 1} size={f.pageSize ?? 25} />;
}
