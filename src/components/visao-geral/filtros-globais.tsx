"use client";
import { useRouter } from "next/navigation";
import { LimparFiltros, SelectFiltro, ToggleFiltro } from "@/components/filtros/campos";
import { BuscaProjetoFiltro } from "@/components/filtros/busca-projeto";
import { fmtCompetencia } from "@/lib/format";
import { ORIGIN_LABEL, STATUS_LABEL, type CollectionStatus } from "@/types/domain";
export interface OpcoesFiltro { competencias: string[]; fundacoes: string[]; institutos: string[]; ministerios: string[]; responsaveis: string[]; flags: string[]; projetos: { id: string; nome: string }[] }
export const FiltrosGlobais = ({ op, etapas, comPerspectiva }: { op: OpcoesFiltro; etapas: CollectionStatus[]; comPerspectiva?: boolean }) => {
  const router = useRouter();
  return (
    <div className="space-y-2.5">
      <BuscaProjetoFiltro projetos={op.projetos} aoSelecionar={(nome) => router.push(`/cobrancas?q=${encodeURIComponent(nome)}&status=all`)} />
      <div className="panel flex flex-wrap items-end gap-2.5 px-4 py-3">
        {comPerspectiva && <SelectFiltro chave="p" rotulo="Perspectiva" todos="Projeto" opcoes={[{ v: "innovatis", l: "Innovatis" }]} w="w-[120px]" />}
        <SelectFiltro chave="competencia" rotulo="Competência" todos="Todas" opcoes={op.competencias.map((c) => ({ v: c, l: fmtCompetencia(c) }))} w="w-[120px]" />
        <SelectFiltro chave="hub" rotulo="HUB" opcoes={["IFES", "GOV"]} w="w-[90px]" />
        <SelectFiltro chave="foundation" rotulo="Fundação" opcoes={op.fundacoes} />
        <SelectFiltro chave="institute" rotulo="Instituto" opcoes={op.institutos} />
        <SelectFiltro chave="ministry" rotulo="Ministério / Governo" opcoes={op.ministerios} />
        <SelectFiltro chave="stage" rotulo="Fase" todos="Todas" opcoes={["A", "B", "C", "D"]} w="w-[90px]" />
        <SelectFiltro chave="status" rotulo="Situação do projeto" todos="Ativo (padrão)" opcoes={[{ v: "all", l: "Todas" }, ...(["backlog", "lost"] as const).map((s) => ({ v: s, l: STATUS_LABEL[s] }))]} />
        <SelectFiltro chave="etapa" rotulo="Etapa da cobrança" todos="Todas" opcoes={etapas.map((e) => ({ v: e.id, l: `${e.hub} · ${e.display_label}` }))} w="min-w-[200px]" />
        <SelectFiltro chave="responsavel" rotulo="Responsável" opcoes={op.responsaveis} />
        <SelectFiltro chave="origem" rotulo="Origem" todos="Todas" opcoes={Object.entries(ORIGIN_LABEL).map(([v, l]) => ({ v, l }))} />
        <ToggleFiltro chave="provisorios" rotulo="Incluir provisórios" padraoLigado />
        <LimparFiltros />
      </div>
    </div>
  );
};
