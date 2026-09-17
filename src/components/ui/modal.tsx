"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
export const Modal = ({ aberto, titulo, onFechar, children, largura = "max-w-lg" }: { aberto: boolean; titulo: string; onFechar: () => void; children: React.ReactNode; largura?: string }) => {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (!d) return; if (aberto && !d.open) d.showModal(); if (!aberto && d.open) d.close(); }, [aberto]);
  return (
    <dialog ref={ref} onClose={onFechar} className={`w-full ${largura} rounded-lg border border-line bg-white p-0 shadow-panel backdrop:bg-navy/40`}>
      <div className="flex items-center justify-between border-b border-line px-5 py-3"><h2 className="text-[14px] font-semibold uppercase tracking-wide">{titulo}</h2><button onClick={onFechar} className="text-ink-faint hover:text-ink" aria-label="Fechar"><X size={16} /></button></div>
      <div className="px-5 py-4">{aberto && children}</div>
    </dialog>
  );
};
