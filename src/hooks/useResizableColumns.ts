"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type ColumnWidthConfig = number | { minWidth?: number; defaultWidth?: number; maxWidth?: number };

export interface UseResizableColumnsOptions {
  columnCount: number;
  defaultWidths?: ColumnWidthConfig[];
  minColumnWidth?: number;
}

const larguraPadrao = (cfg: ColumnWidthConfig | undefined) => (typeof cfg === "number" ? cfg : (cfg?.defaultWidth ?? 150));
const larguraMinima = (cfg: ColumnWidthConfig | undefined, padrao: number) => (typeof cfg === "object" ? (cfg.minWidth ?? padrao) : padrao);
const larguraMaxima = (cfg: ColumnWidthConfig | undefined) => (typeof cfg === "object" ? cfg.maxWidth : undefined);

/** Larguras de coluna redimensionáveis por arraste (sem persistência entre sessões). */
export function useResizableColumns({ columnCount, defaultWidths, minColumnWidth = 50 }: UseResizableColumnsOptions) {
  const [columnWidths, setColumnWidths] = useState<number[]>(() => Array.from({ length: columnCount }, (_, i) => larguraPadrao(defaultWidths?.[i])));
  const arrastando = useRef<{ index: number; xInicial: number; larguraInicial: number } | null>(null);
  const semeadoRef = useRef(false);

  useEffect(() => {
    // Primeira vez que temos larguras reais (medidas do DOM): usa exatamente elas, sem "achatar" pra um padrão.
    if (columnCount && defaultWidths && !semeadoRef.current) {
      semeadoRef.current = true;
      setColumnWidths(Array.from({ length: columnCount }, (_, i) => larguraPadrao(defaultWidths[i])));
      return;
    }
    setColumnWidths((atual) => (atual.length === columnCount ? atual : Array.from({ length: columnCount }, (_, i) => atual[i] ?? larguraPadrao(defaultWidths?.[i]))));
  }, [columnCount, defaultWidths]);

  const aoMover = useCallback((e: MouseEvent) => {
    const d = arrastando.current;
    if (!d) return;
    const cfg = defaultWidths?.[d.index];
    let nova = d.larguraInicial + (e.clientX - d.xInicial);
    nova = Math.max(larguraMinima(cfg, minColumnWidth), nova);
    const max = larguraMaxima(cfg);
    if (max) nova = Math.min(max, nova);
    setColumnWidths((atual) => { const c = [...atual]; c[d.index] = nova; return c; });
  }, [defaultWidths, minColumnWidth]);

  const aoSoltar = useCallback(() => {
    arrastando.current = null;
    document.removeEventListener("mousemove", aoMover);
    document.removeEventListener("mouseup", aoSoltar);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [aoMover]);

  const handleMouseDown = useCallback((index: number, e: MouseEvent | React.MouseEvent) => {
    arrastando.current = { index, xInicial: e.clientX, larguraInicial: columnWidths[index] ?? larguraPadrao(defaultWidths?.[index]) };
    document.addEventListener("mousemove", aoMover);
    document.addEventListener("mouseup", aoSoltar);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [columnWidths, defaultWidths, aoMover, aoSoltar]);

  useEffect(() => () => { document.removeEventListener("mousemove", aoMover); document.removeEventListener("mouseup", aoSoltar); }, [aoMover, aoSoltar]);

  return { columnWidths, handleMouseDown };
}
