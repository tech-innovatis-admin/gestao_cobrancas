import { Suspense } from "react";
import { Topbar } from "@/components/layout/topbar";
import { FiltrosGlobais } from "@/components/visao-geral/filtros-globais";
import { CardsExecutivos } from "@/components/visao-geral/cards";
import { GraficosVisaoGeral } from "@/components/visao-geral/graficos";
import { Consolidado } from "@/components/visao-geral/consolidado";
import { TabelaGerencial } from "@/components/visao-geral/tabelas-gerenciais";
import { Skeleton } from "@/components/ui/basicos";
import { perfilAtual } from "@/services/authService";
import { listarRecebiveisTodos, opcoesDeFiltro } from "@/services/receivablesService";
import { listarEtapas } from "@/services/catalogService";
import { cards, consolidadoMensal, graficos, type Perspectiva } from "@/services/dashboardService";
import { competenciaAtual } from "@/lib/format";
import { filtrosDaUrl, type SP } from "@/lib/filtros-url";

export const dynamic = "force-dynamic";
export default async function VisaoGeralPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams; const perfil = await perfilAtual();
  return (<><Topbar titulo="Visão Executiva" perfil={perfil} /><main className="space-y-4 p-5">
    <Suspense fallback={<Skeleton className="h-24" />}><FiltrosServer /></Suspense>
    <Suspense key={JSON.stringify(sp)} fallback={<><Skeleton className="h-20" /><Skeleton className="h-96" /></>}><Conteudo sp={sp} /></Suspense>
  </main></>);
}
async function FiltrosServer() { const [op, etapas] = await Promise.all([opcoesDeFiltro(), listarEtapas()]); return <FiltrosGlobais op={op} etapas={etapas} comPerspectiva />; }
async function Conteudo({ sp }: { sp: SP }) {
  const p = (sp.p as Perspectiva) || "ambos";
  const f = filtrosDaUrl(sp); f.competencia = undefined; // agregações precisam de todas as competências; o filtro de competência recorta abaixo
  const todos = await listarRecebiveisTodos(f);
  const rows = sp.competencia ? todos.filter((r) => r.competence === sp.competencia) : todos;
  const atual = competenciaAtual();
  return (<>
    <CardsExecutivos c={cards(rows, p)} />
    <GraficosVisaoGeral g={graficos(todos, p)} />
    <Consolidado linhas={consolidadoMensal(todos)} />
    <div className="grid grid-cols-2 gap-4">
      <TabelaGerencial titulo="Projetos Atrasados" tom="danger" rows={rows.filter((r) => r.is_overdue).sort((a, b) => Number(b.balance_project) - Number(a.balance_project))} vazio="Nenhum recebível em atraso na carteira ativa." />
      <TabelaGerencial titulo="Projetos do Mês Atual" tom="ok" rows={todos.filter((r) => r.competence === atual && r.counts_in_portfolio).sort((a, b) => a.hub.localeCompare(b.hub) || Number(b.balance_project) - Number(a.balance_project))} vazio="Nenhum recebível na competência atual." />
    </div>
  </>);
}
