"use client";
import { useUrlFiltros } from "./use-url-filtros";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TODOS_VALUE = "__todos__";

export const SelectFiltro = ({ chave, rotulo, opcoes, todos = "Todos", w = "min-w-[130px]" }: { chave: string; rotulo: string; opcoes: { v: string; l: string }[] | string[]; todos?: string; w?: string }) => {
  const { get, set } = useUrlFiltros();
  const ops = opcoes.map((o) => (typeof o === "string" ? { v: o, l: o } : o));
  const atual = get(chave) || TODOS_VALUE;
  const rotuloDe = (v: string) => (v === TODOS_VALUE ? todos : ops.find((o) => o.v === v)?.l ?? v);
  const id = `filtro-${chave}`;
  return (
    <div className="flex flex-col gap-0.5">
      <Label htmlFor={id} className="text-[12px] text-muted-foreground">{rotulo}</Label>
      <Select value={atual} onValueChange={(v) => set({ [chave]: v === TODOS_VALUE ? "" : v })}>
        <SelectTrigger id={id} className={w}><SelectValue>{rotuloDe}</SelectValue></SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS_VALUE}>{todos}</SelectItem>
          {ops.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
};
export const BuscaFiltro = ({ chave = "q", rotulo = "Buscar", placeholder, w = "min-w-[220px]" }: { chave?: string; rotulo?: string; placeholder?: string; w?: string }) => {
  const { get, set } = useUrlFiltros();
  let t: ReturnType<typeof setTimeout>;
  const id = `filtro-${chave}`;
  return (
    <div className="flex flex-col gap-0.5">
      <Label htmlFor={id} className="text-[12px] text-muted-foreground">{rotulo}</Label>
      <Input id={id} className={w} placeholder={placeholder} defaultValue={get(chave)} onChange={(e) => { clearTimeout(t); const v = e.target.value; t = setTimeout(() => set({ [chave]: v }), 400); }} />
    </div>
  );
};
export const ToggleFiltro = ({ chave, rotulo, ligadoQuando = "1", padraoLigado = false }: { chave: string; rotulo: string; ligadoQuando?: string; padraoLigado?: boolean }) => {
  const { get, set } = useUrlFiltros();
  const atual = get(chave); const ligado = atual ? atual === ligadoQuando : padraoLigado;
  return <label className="flex h-8 items-center gap-1.5 self-end text-[12px] text-muted-foreground"><input type="checkbox" checked={ligado} onChange={(e) => set({ [chave]: e.target.checked ? (padraoLigado ? "" : ligadoQuando) : (padraoLigado ? "0" : "") })} />{rotulo}</label>;
};
export const LimparFiltros = () => { const { limpar } = useUrlFiltros(); return <Button type="button" variant="ghost" size="sm" onClick={limpar} className="self-end">Limpar</Button>; };
