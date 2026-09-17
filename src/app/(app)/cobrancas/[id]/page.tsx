import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { VoltarButton } from "@/components/cobrancas/voltar-button";
import { DetalheProjeto } from "@/components/cobrancas/detalhe-projeto";
import { perfilAtual, listarPerfis } from "@/services/authService";
import { obterProjeto } from "@/services/projectsService";
import { listarRecebiveisPorProjeto } from "@/services/receivablesService";
import { listarEtapas } from "@/services/catalogService";
import { historicoProjeto } from "@/services/auditService";
import { consolidadoMensal } from "@/services/dashboardService";

export const dynamic = "force-dynamic";
export default async function ProjetoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await perfilAtual();
  const projeto = await obterProjeto(id);
  if (!projeto) notFound();
  const master = perfil.role === "master_admin";
  const [recebiveis, etapas, perfis, historico] = await Promise.all([
    listarRecebiveisPorProjeto(id),
    listarEtapas(),
    listarPerfis(),
    master ? historicoProjeto(id, 5) : Promise.resolve([]),
  ]);
  return (<>
    <Topbar titulo={projeto.name} perfil={perfil} extra={<VoltarButton />} />
    <main className="p-5">
      <DetalheProjeto projeto={projeto} recebiveis={recebiveis} linhasConsolidado={consolidadoMensal(recebiveis)} etapas={etapas} perfis={perfis} perfil={perfil} historico={historico} />
    </main>
  </>);
}
