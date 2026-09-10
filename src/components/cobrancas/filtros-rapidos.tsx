"use client";
import { useUrlFiltros } from "@/components/filtros/use-url-filtros";
import { Button } from "@/components/ui/button";
const itens: { v: string; l: string }[] = [
  { v: "atrasados", l: "Atrasados" }, { v: "mes_atual", l: "Mês atual" }, { v: "atrasados_mes_atual", l: "Atrasados + mês atual" },
  { v: "proximos", l: "Próximos" }, { v: "todos", l: "Todos" }, { v: "minhas", l: "Minhas cobranças" }, { v: "prazo_vencido", l: "Prazo operacional vencido" },
];
export const FiltrosRapidos = () => {
  const { get, set } = useUrlFiltros(); const atual = get("rapido") || (get("competencia") ? "mes" : "todos");
  return (
    <div className="flex flex-wrap gap-1">
      {itens.map((i) => <Button key={i.v} type="button" size="sm" variant={atual === i.v ? "default" : "outline"} onClick={() => set({ rapido: i.v === "todos" ? "" : i.v, competencia: "" })}>{i.l}</Button>)}
      {atual === "mes" && <Button type="button" size="sm" disabled>Mês específico</Button>}
    </div>
  );
};
