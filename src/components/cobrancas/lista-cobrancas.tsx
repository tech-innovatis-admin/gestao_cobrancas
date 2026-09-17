"use client";
import { useRouter } from "next/navigation";
import { TabelaCobrancas } from "./tabela";
import type { Receivable } from "@/types/domain";
export const ListaCobrancas = ({ rows, total, page, size }: { rows: Receivable[]; total: number; page: number; size: number }) => {
  const router = useRouter();
  return <TabelaCobrancas rows={rows} total={total} page={page} size={size} onAbrir={(projectId) => router.push(`/cobrancas/${projectId}`)} />;
};
