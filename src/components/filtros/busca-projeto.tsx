"use client";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const LIMITE = 8;

export const BuscaProjetoFiltro = ({ projetos, aoSelecionar, placeholder = "Nome do projeto" }: { projetos: { id: string; nome: string }[]; aoSelecionar: (nome: string) => void; placeholder?: string }) => {
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
    <div ref={ref} className="relative flex flex-col gap-0.5">
      <Label htmlFor="busca-projeto" className="text-[12px] text-muted-foreground">Projeto</Label>
      <Input
        id="busca-projeto"
        className="w-[320px]"
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
      {aberto && termo && (
        <div className="absolute top-full left-0 z-20 mt-1 w-[320px] rounded-md border border-line bg-white py-1 shadow-panel">
          {resultados.length === 0
            ? <p className="px-3 py-1.5 text-[12px] text-ink-faint">Nenhum projeto encontrado.</p>
            : resultados.map((p, i) => (
              <button key={p.id} type="button" onClick={() => selecionar(p.nome)} onMouseEnter={() => setDestaque(i)}
                className={`block w-full truncate px-3 py-1.5 text-left text-[12px] ${i === destaque ? "bg-sidebar-accent/50" : ""}`}>{p.nome}</button>
            ))}
        </div>
      )}
    </div>
  );
};
