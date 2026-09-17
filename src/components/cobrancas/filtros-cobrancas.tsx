"use client";
import { LimparFiltros, SelectFiltro, ToggleFiltro } from "@/components/filtros/campos";
import { BuscaProjetoFiltro } from "@/components/filtros/busca-projeto";
import { useUrlFiltros } from "@/components/filtros/use-url-filtros";
import { fmtCompetencia } from "@/lib/format";
import { FIN_LABEL, ORIGIN_LABEL, STATUS_LABEL, type CollectionStatus } from "@/types/domain";
import type { OpcoesFiltro } from "@/components/visao-geral/filtros-globais";
export const FiltrosCobrancas = ({ op, etapas }: { op: OpcoesFiltro; etapas: CollectionStatus[] }) => {
  const { set } = useUrlFiltros();
  return (
    <div className="space-y-2.5">
      <BuscaProjetoFiltro projetos={op.projetos} aoSelecionar={(nome) => set({ q: nome, status: "all" })} />
      <div className="panel flex flex-wrap items-end gap-2.5 px-4 py-3">
        <SelectFiltro chave="competencia" rotulo="Competência" todos="Todas" opcoes={op.competencias.map((c) => ({ v: c, l: fmtCompetencia(c) }))} w="w-[115px]" />
        <SelectFiltro chave="stage" rotulo="Fase" todos="Todas" opcoes={["A", "B", "C", "D"]} w="w-[80px]" />
        <SelectFiltro chave="status" rotulo="Situação" todos="Ativo" opcoes={[{ v: "all", l: "Todas" }, ...(["backlog", "lost"] as const).map((s) => ({ v: s, l: STATUS_LABEL[s] }))]} w="w-[100px]" />
        <SelectFiltro chave="hub" rotulo="HUB" opcoes={["IFES", "GOV"]} w="w-[85px]" />
        <SelectFiltro chave="ministry" rotulo="Ministério/Governo" opcoes={op.ministerios} />
        <SelectFiltro chave="institute" rotulo="Instituto" opcoes={op.institutos} w="w-[110px]" />
        <SelectFiltro chave="foundation" rotulo="Fundação" opcoes={op.fundacoes} w="w-[110px]" />
        <SelectFiltro chave="etapa" rotulo="Etapa da cobrança" todos="Todas" opcoes={etapas.map((e) => ({ v: e.id, l: `${e.hub} · ${e.display_label}` }))} w="min-w-[190px]" />
        <SelectFiltro chave="responsavel" rotulo="Responsável" opcoes={op.responsaveis} w="w-[120px]" />
        <SelectFiltro chave="origem" rotulo="Origem" todos="Todas" opcoes={Object.entries(ORIGIN_LABEL).map(([v, l]) => ({ v, l }))} w="w-[120px]" />
        <SelectFiltro chave="fin" rotulo="Situação financeira" todos="Todas" opcoes={Object.entries(FIN_LABEL).map(([v, l]) => ({ v, l }))} w="w-[130px]" />
        <SelectFiltro chave="flag" rotulo="FLAG" todos="Todas" opcoes={op.flags} w="w-[100px]" />
        <ToggleFiltro chave="prazo" rotulo="Prazo vencido" />
        <ToggleFiltro chave="provisorios" rotulo="Incluir provisórios" padraoLigado />
        <LimparFiltros />
      </div>
    </div>
  );
};
