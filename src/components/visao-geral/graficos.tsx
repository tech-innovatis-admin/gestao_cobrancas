"use client";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtBRL, fmtCompetencia } from "@/lib/format";
import type { Graficos } from "@/services/dashboardService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const C = { navy: "#0F1E3D", ok: "#1E7A46", info: "#1F4FA3", danger: "#B42323", warn: "#B25E09", grey: "#8A93A2" };
const compacto = (v: number) => (v >= 1e6 ? `${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` : v >= 1e3 ? `${Math.round(v / 1e3)} mil` : String(v));
const Painel = ({ t, children, h = 220 }: { t: string; children: React.ReactNode; h?: number }) => <div className="panel"><div className="panel-head"><span className="panel-title">{t}</span></div><div className="p-3" style={{ height: h }}>{children}</div></div>;
const Barras = ({ data, cores }: { data: { nome: string; valor: number }[]; cores?: string[] }) => (
  data.length === 0 ? <p className="p-4 text-[12px] text-ink-faint">Sem dados.</p> :
  <ResponsiveContainer><BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}><CartesianGrid horizontal={false} stroke="#E1E4E9" /><XAxis type="number" tickFormatter={compacto} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 11 }} /><Tooltip formatter={(v) => fmtBRL(Number(v))} /><Bar dataKey="valor" fill={C.info} radius={2}>{cores && data.map((_, i) => <Cell key={i} fill={cores[i % cores.length]} />)}</Bar></BarChart></ResponsiveContainer>
);
const Contagem = ({ data, cores }: { data: { nome: string; valor: number }[]; cores: string[] }) => (
  <ResponsiveContainer><BarChart data={data}><CartesianGrid vertical={false} stroke="#E1E4E9" /><XAxis dataKey="nome" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="valor" name="Projetos" radius={2}>{data.map((_, i) => <Cell key={i} fill={cores[i % cores.length]} />)}</Bar></BarChart></ResponsiveContainer>
);

export const GraficosVisaoGeral = ({ g }: { g: Graficos }) => (
  <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
    <div className="col-span-2 xl:col-span-3"><Painel t="Previsto x Recebido por mês" h={200}>
      <ResponsiveContainer><BarChart data={g.porMes.map((m) => ({ ...m, mes: fmtCompetencia(m.mes) }))}><CartesianGrid vertical={false} stroke="#E1E4E9" /><XAxis dataKey="mes" tick={{ fontSize: 11 }} /><YAxis tickFormatter={compacto} tick={{ fontSize: 11 }} /><Tooltip formatter={(v) => fmtBRL(Number(v))} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="previsto" name="Previsto" fill={C.navy} radius={2} /><Bar dataKey="recebido" name="Recebido" fill={C.ok} radius={2} /></BarChart></ResponsiveContainer>
    </Painel></div>
    <Painel t="Saldo em aberto: no prazo x atrasado"><Barras data={g.prazoAtraso} cores={[C.info, C.danger]} /></Painel>
    <Painel t="Saldo em aberto por HUB"><Barras data={g.porHub} cores={[C.navy, C.info]} /></Painel>
    <Painel t="Saldo em aberto por etapa da cobrança"><Barras data={g.porEtapa} /></Painel>
    <Painel t="Saldo por responsável"><Barras data={g.porResponsavel} /></Painel>
    <Painel t="Top 5 projetos em atraso">
      {g.top5Atraso.length === 0 ? <p className="p-4 text-[12px] text-ink-faint">Nenhum projeto em atraso.</p> :
      <Table><TableHeader><TableRow><TableHead>Projeto</TableHead><TableHead className="num">Em atraso</TableHead><TableHead>Competência mais antiga</TableHead></TableRow></TableHeader><TableBody>
        {g.top5Atraso.map((t) => <TableRow key={t.projectId} className="clicavel"><TableCell className="max-w-[200px] truncate"><Link href={`/cobrancas/${t.projectId}`} className="hover:text-action">{t.projeto}</Link></TableCell><TableCell className="num text-danger">{fmtBRL(t.valor)}</TableCell><TableCell>{fmtCompetencia(t.competencia)}</TableCell></TableRow>)}
      </TableBody></Table>}
    </Painel>
    <div className="grid grid-cols-2 gap-3"><Painel t="Projetos por fase" h={180}><Contagem data={g.porFase} cores={[C.ok, C.info, C.grey, C.warn, C.danger]} /></Painel><Painel t="Situação da carteira" h={180}><Contagem data={g.carteira} cores={[C.ok, C.warn, C.danger]} /></Painel></div>
  </div>
);
