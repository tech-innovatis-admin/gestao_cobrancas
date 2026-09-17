"use client";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const LIMITE = 8;

export const BuscaProjetoFiltro = ({ projetos, aoSelecionar, placeholder = "Buscar por nome do projeto..." }: { projetos: { id: string; nome: string }[]; aoSelecionar: (nome: string) => void; placeholder?: string }) => {
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const aoClicarFora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  const termo = norm(texto.trim());
  const resultados = termo ? projetos.filter((p) => norm(p.nome).includes(termo)).slice(0, LIMITE) : [];

  const selecionar = (nome: string) => { setTexto(nome); setAberto(false); aoSelecionar(nome); };

  return (
    <div className="panel px-4 py-3">
      <div ref={ref} className="relative flex max-w-[520px] flex-col gap-1.5">
        <Label htmlFor="busca-projeto" className="text-[13px] font-medium text-muted-foreground">Buscar projeto</Label>
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="busca-projeto"
            className="h-12 pl-10 text-[16px]"
            placeholder={placeholder}
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setAberto(true); setDestaque(0); }}
            onFocus={() => setAberto(true)}
            onKeyDown={(e) => {
              if (!aberto || resultados.length === 0) return;
              if (e.key === "ArrowDown") { e.preventDefault(); setDestaque((d) => Math.min(d + 1, resultados.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setDestaque((d) => Math.max(d - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); selecionar(resultados[destaque].nome); }
              else if (e.key === "Escape") setAberto(false);
            }}
          />
        </div>
        {aberto && termo && (
          <div className="absolute top-full left-0 z-20 mt-1 w-full rounded-md border border-line bg-white py-1 shadow-panel">
            {resultados.length === 0
              ? <p className="px-3.5 py-2 text-[13px] text-ink-faint">Nenhum projeto encontrado.</p>
              : resultados.map((p, i) => (
                <button key={p.id} type="button" onClick={() => selecionar(p.nome)} onMouseEnter={() => setDestaque(i)}
                  className={`block w-full truncate px-3.5 py-2 text-left text-[14px] ${i === destaque ? "bg-sidebar-accent/50" : ""}`}>{p.nome}</button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
