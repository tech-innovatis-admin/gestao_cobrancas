# Cobranças — Filtros, Tabela e Drawer — Migração visual para shadcn/ui — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar a tela de Cobranças (exceto o painel "Ações do Master Admin", que é o próximo/último sub-projeto) pro shadcn/ui: botões de filtro rápido, a tabela principal (22 colunas), paginação, o painel lateral de detalhes (`Drawer`→`Sheet`), histórico, o formulário operacional (com sua lógica própria de diff/conflito) e o formulário de novo projeto.

**Architecture:** Reaplica os padrões já validados (`Badge`/`Table`/`Select`/`Button` mecânicos) e estende o padrão react-hook-form+zod pros 2 formulários restantes que ainda faltam (`novo-projeto.tsx`, que já tem schema zod em `receivablesActions.ts`; `form-operacional.tsx`, que usa `useForm` com `watch()` em vez de `zodResolver` — não há regra de validação real a impor além de tipos, então a "validação" aqui é só a estrutura de dados, mantendo a lógica de diff/confirmação exatamente como está). `Drawer`→`Sheet`: o `Sheet` do shadcn é controlado por `open`/`onOpenChange` (Base UI `Dialog`), substitui o componente customizado `aberto`/`onFechar`.

**Tech Stack:** Next.js 15, React 19, shadcn/ui (`Table`, `Select`, `Input`, `Textarea`, `Sheet`, `Button`, `Field` já instalados), react-hook-form + zod.

Este é o 4º dos 5 sub-projetos (Layout, Auditoria, Visão Geral já concluídos) — ver `docs/superpowers/specs/2026-09-09-migracao-visual-completa-design.md`. O último (`acoes-master.tsx`) fica pra depois deste.

**Regra do projeto (sem exceção):** nenhuma mensagem de commit criada por este plano deve conter linha de atribuição a IA.

---

## Pré-requisitos confirmados (não repetir)

- `src/components/filtros/campos.tsx` (usado por `filtros-cobrancas.tsx`) já migrado — **`filtros-cobrancas.tsx` não precisa de nenhuma mudança**.
- `src/components/cobrancas/lista-cobrancas.tsx` só compõe `TabelaCobrancas`+`DrawerCobranca`, sem usar nenhum componente do sistema antigo — **não precisa de mudança**.
- `src/components/ui/badges-dominio.tsx` já migrado (sub-projeto Auditoria) — `BadgeFase`/`BadgeFin`/`BadgeSituacao`/`BadgeSync`/`BadgeProvisorio`/`BadgeConsolidado` já usam `variant`, nenhuma mudança necessária nos call-sites que só os consomem.
- `.clicavel` já é `@utility` independente (funciona com `Table` do shadcn).
- `src/services/receivablesActions.ts` já tem o schema `projeto` (zod) usado por `criarProjeto` — `novo-projeto.tsx` já usa `type ProjetoInput` inferido dele.
- `src/components/ui/sheet.tsx`: `Sheet` (= `Dialog.Root`, prop `open`/`onOpenChange`), `SheetContent` (prop `side`, default `sm:max-w-sm` — precisa de override pra 640px), `SheetHeader`, `SheetTitle`, `SheetDescription`, `SheetFooter`. Fecha automaticamente (unmount do conteúdo) quando `open=false`, igual o `{aberto && children}` do `Drawer` antigo.
- Gotcha do `SelectValue` (children como função resolvedora) e o padrão `Field`/`FieldLabel`/`FieldError`/`Controller` já documentados em tasks anteriores — reaplicar aqui.

---

## Task 1: Migrar `filtros-rapidos.tsx` para `Button`

**Files:** Modify: `src/components/cobrancas/filtros-rapidos.tsx`

- [ ] **Passo 1: Confirmar o arquivo real** (`cat src/components/cobrancas/filtros-rapidos.tsx`)

- [ ] **Passo 2: Trocar o `<button>` cru por `Button`**

```tsx
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
```

Note: o item ativo (`border-navy bg-navy text-white`) vira `variant="default"` (cor primária do tema); os demais viram `variant="outline"`. O "Mês específico" era um `<span>` estático (não clicável) — vira um `Button` `disabled` pra manter a aparência de "estado", sem fingir ser clicável.

- [ ] **Passo 3: Verificar tipos** (`npm run typecheck` — sem erro novo)

- [ ] **Passo 4: Teste visual** — `/cobrancas` (Supabase local + dev server rodando, login `admin@teste.local`/`Teste@123`), confirmar os botões de filtro rápido, clicar em um e confirmar que filtra e destaca.

- [ ] **Passo 5: Commit**

```bash
git add src/components/cobrancas/filtros-rapidos.tsx
git commit -m "feat: migra FiltrosRapidos para Button do shadcn"
```

---

## Task 2: Migrar a tabela de `tabela.tsx` (22 colunas)

**Files:** Modify: `src/components/cobrancas/tabela.tsx`

Tabela grande, mas a migração é mecânica (mesmo padrão já usado 6x). Atenção especial: as colunas "Fase" e "Competência" têm `className="fix"`/`"fix left-[52px]!"` (colunas fixas/sticky ao rolar horizontalmente — CSS customizado, não removar) e a linha tem cor condicional (`r.is_overdue`/`r.sync_status === "error"`).

- [ ] **Passo 1: Confirmar o arquivo real** (`cat src/components/cobrancas/tabela.tsx`)

- [ ] **Passo 2: Adicionar o import e trocar `<table>`/`<thead>`/`<tbody>`/`<tr>`/`<th>`/`<td>` pelos equivalentes `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`**, preservando TODAS as 22 colunas, o `onClick` de ordenação no cabeçalho, os ícones `ArrowUp`/`ArrowDown`, as classes `fix`/`fix z-20!`/`fix left-[52px]!`, a cor condicional da linha (`cn("clicavel", r.is_overdue && "bg-danger-soft/40!", r.sync_status === "error" && "bg-danger-soft/60!")`), e o `onClick={() => onAbrir(r.id)}` na linha:

```tsx
import { ArrowDown, ArrowUp, Download } from "lucide-react";
import { useUrlFiltros } from "@/components/filtros/use-url-filtros";
import { cn } from "@/lib/utils";
import { fmtBRL, fmtCompetencia, fmtData, fmtDataHora } from "@/lib/format";
import { BadgeConsolidado, BadgeFase, BadgeFin, BadgeProvisorio, BadgeSync } from "@/components/ui/badges-dominio";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/basicos";
import { Paginacao } from "./paginacao";
import { exportarCsv } from "./exportar";
import { ORIGIN_LABEL, type Receivable } from "@/types/domain";

const COLS: { k: string; l: string; num?: boolean; sort?: string; fix?: boolean }[] = [
  { k: "stage", l: "Fase", sort: "stage_code", fix: true }, { k: "comp", l: "Competência", sort: "competence", fix: true }, { k: "hub", l: "HUB", sort: "hub" }, { k: "min", l: "Ministério/Governo" }, { k: "inst", l: "Instituto" }, { k: "fund", l: "Fundação" }, { k: "proj", l: "Projeto", sort: "project_name" },
  { k: "pp", l: "Previsto Proj.", num: true, sort: "planned_project" }, { k: "rp", l: "Recebido Proj.", num: true, sort: "received_project" }, { k: "sp", l: "Saldo Proj.", num: true, sort: "balance_project" },
  { k: "pi", l: "Previsto Innov.", num: true }, { k: "ri", l: "Recebido Innov.", num: true }, { k: "si", l: "Saldo Innov.", num: true, sort: "balance_innovatis" },
  { k: "etapa", l: "Etapa da cobrança", sort: "collection_status_label" }, { k: "motivo", l: "Motivo" }, { k: "acao", l: "Ação" }, { k: "resp", l: "Responsável", sort: "responsible_name" }, { k: "prazo", l: "Prazo", sort: "operational_deadline" },
  { k: "fin", l: "Situação financeira" }, { k: "orig", l: "Origem" }, { k: "upd", l: "Última atualização", sort: "updated_at" }, { k: "sync", l: "Sincronização" },
];
export const TabelaCobrancas = ({ rows, total, page, size, onAbrir }: { rows: Receivable[]; total: number; page: number; size: number; onAbrir: (id: string) => void }) => {
  const { get, set } = useUrlFiltros(); const sort = get("sort") || "competence", dir = get("dir") || "asc";
  const ordenar = (s?: string) => s && set({ sort: s, dir: sort === s && dir === "asc" ? "desc" : "asc" });
  const trunc = (v: string | null, w = "max-w-[180px]") => <span className={cn("block truncate", w)} title={v ?? ""}>{v ?? "—"}</span>;
  return (
    <div className="panel">
      <div className="panel-head"><span className="panel-title">Recebíveis <span className="num font-normal text-ink-faint">({total})</span></span><Button variant="outline" size="sm" onClick={() => exportarCsv(rows)}><Download size={13} /> Exportar CSV (página)</Button></div>
      {rows.length === 0 ? <EmptyState msg="Nenhum recebível para os filtros selecionados." /> : (
        <div className="max-h-[calc(100vh-330px)] overflow-auto">
          <Table><TableHeader><TableRow>{COLS.map((c) => <TableHead key={c.k} className={cn(c.num && "num", c.fix && "fix z-20!", c.sort && "cursor-pointer select-none")} onClick={() => ordenar(c.sort)}>{c.l}{sort === c.sort && (dir === "asc" ? <ArrowUp size={11} className="ml-1 inline" /> : <ArrowDown size={11} className="ml-1 inline" />)}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{rows.map((r) => (
            <TableRow key={r.id} className={cn("clicavel", r.is_overdue && "bg-danger-soft/40!", r.sync_status === "error" && "bg-danger-soft/60!")} onClick={() => onAbrir(r.id)}>
              <TableCell className="fix"><BadgeFase code={r.stage_code} color={r.stage_color} pending={r.stage_pending} /></TableCell>
              <TableCell className="fix left-[52px]!"><span className="inline-flex items-center gap-1">{fmtCompetencia(r.competence)}{r.legacy_consolidated && <BadgeConsolidado />}</span></TableCell>
              <TableCell>{r.hub}</TableCell><TableCell>{trunc(r.ministry_government, "max-w-[120px]")}</TableCell><TableCell>{trunc(r.institute, "max-w-[90px]")}</TableCell><TableCell>{trunc(r.foundation, "max-w-[90px]")}</TableCell>
              <TableCell><span className="flex max-w-[240px] items-center gap-1.5"><span className="truncate font-medium" title={r.project_name}>{r.project_name}</span>{r.provisional && <BadgeProvisorio />}</span></TableCell>
              <TableCell className="num">{fmtBRL(r.planned_project)}</TableCell><TableCell className="num">{fmtBRL(r.received_project)}</TableCell><TableCell className={cn("num", Number(r.balance_project) > 0.01 && "font-medium")}>{fmtBRL(r.balance_project)}</TableCell>
              <TableCell className="num">{fmtBRL(r.planned_innovatis)}</TableCell><TableCell className="num">{fmtBRL(r.received_innovatis)}</TableCell><TableCell className="num">{fmtBRL(r.balance_innovatis)}</TableCell>
              <TableCell>{trunc(r.collection_status_label, "max-w-[200px]")}</TableCell><TableCell>{trunc(r.reason)}</TableCell><TableCell>{trunc(r.action)}</TableCell><TableCell>{trunc(r.responsible_name, "max-w-[110px]")}</TableCell>
              <TableCell className={cn(r.deadline_overdue && "font-medium text-danger")}>{fmtData(r.operational_deadline)}</TableCell>
              <TableCell><BadgeFin s={r.overall_financial_status} /></TableCell><TableCell>{ORIGIN_LABEL[r.origin]}</TableCell><TableCell className="text-ink-muted">{fmtDataHora(r.updated_at)}</TableCell><TableCell><BadgeSync s={r.sync_status} erro={r.sync_error} /></TableCell>
            </TableRow>))}</TableBody></Table>
        </div>)}
      <Paginacao page={page} size={size} total={total} />
    </div>
  );
};
```

- [ ] **Passo 3: Verificar tipos e nenhum resíduo de `.tbl`** (`npm run typecheck` + `grep -n 'className="tbl"' src/components/cobrancas/tabela.tsx` vazio)

- [ ] **Passo 4: Teste visual** — `/cobrancas`, confirmar a tabela com as 22 colunas, ordenação clicando no cabeçalho, colunas fixas (Fase/Competência) continuam fixas ao rolar horizontalmente, linhas de recebível atrasado/erro de sincronização com fundo avermelhado.

- [ ] **Passo 5: Commit**

```bash
git add src/components/cobrancas/tabela.tsx
git commit -m "feat: migra TabelaCobrancas (22 colunas) para Table do shadcn"
```

---

## Task 3: Migrar o seletor de tamanho de página em `paginacao.tsx`

**Files:** Modify: `src/components/cobrancas/paginacao.tsx`

- [ ] **Passo 1: Confirmar o arquivo real** (`cat src/components/cobrancas/paginacao.tsx`)

- [ ] **Passo 2: Trocar o `<select>` nativo pelo `Select` do shadcn** (mesmo padrão/gotcha do `SelectValue` já usado em `filtros/campos.tsx`):

```tsx
"use client";
import { useUrlFiltros } from "@/components/filtros/use-url-filtros";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
export const Paginacao = ({ page, size, total }: { page: number; size: number; total: number }) => {
  const { set } = useUrlFiltros(); const paginas = Math.max(1, Math.ceil(total / size));
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[12px] text-ink-muted">
      <span className="num">{total === 0 ? "0" : `${(page - 1) * size + 1}–${Math.min(page * size, total)}`} de {total}</span>
      <div className="flex items-center gap-2">
        <Select value={String(size)} onValueChange={(v) => set({ size: v, page: "1" })}>
          <SelectTrigger className="h-7 w-[70px]"><SelectValue>{(v: string) => v}</SelectValue></SelectTrigger>
          <SelectContent>{[25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}>Anterior</Button>
        <span className="num">{page} / {paginas}</span>
        <Button variant="outline" size="sm" disabled={page >= paginas} onClick={() => set({ page: String(page + 1) })}>Próxima</Button>
      </div>
    </div>
  );
};
```

- [ ] **Passo 3: Verificar tipos** (`npm run typecheck`)

- [ ] **Passo 4: Teste visual** — `/cobrancas`, trocar o tamanho de página (25/50/100), confirmar que a URL muda (`size=`) e a lista recarrega com a quantidade certa.

- [ ] **Passo 5: Commit**

```bash
git add src/components/cobrancas/paginacao.tsx
git commit -m "feat: migra Paginacao para Select do shadcn"
```

---

## Task 4: Migrar a tabela de `historico.tsx`

**Files:** Modify: `src/components/cobrancas/historico.tsx`

- [ ] **Passo 1: Confirmar o arquivo real** (`cat src/components/cobrancas/historico.tsx`)

- [ ] **Passo 2: Trocar a tabela**

```tsx
import Link from "next/link";
import { fmtDataHora } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACTION_LABEL, FIELD_LABEL, type AuditLog } from "@/types/domain";
const val = (v: unknown) => (v == null || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
export const Historico = ({ logs, master, receivableId }: { logs: AuditLog[]; master: boolean; receivableId: string }) => (
  <section>
    <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Histórico (últimas 5)</h3>
    {!master ? <p className="text-[12px] text-ink-faint">O histórico detalhado é visível ao Master Admin.</p> : logs.length === 0 ? <p className="text-[12px] text-ink-faint">Sem alterações registradas.</p> : (
      <Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Usuário</TableHead><TableHead>Campo</TableHead><TableHead>Antes</TableHead><TableHead>Depois</TableHead></TableRow></TableHeader><TableBody>
        {logs.flatMap((l) => (l.changed_fields.length ? l.changed_fields : ["—"]).map((c) => <TableRow key={`${l.id}-${c}`}><TableCell>{fmtDataHora(l.occurred_at)}</TableCell><TableCell>{l.actor_name ?? (l.source === "google_sheets" ? "Alteração externa" : "sistema")}</TableCell><TableCell>{c === "—" ? ACTION_LABEL[l.action_type] ?? l.action_type : FIELD_LABEL[c] ?? c}</TableCell><TableCell className="max-w-[120px] truncate text-ink-muted" title={val(l.before_data?.[c])}>{c === "—" ? "" : val(l.before_data?.[c])}</TableCell><TableCell className="max-w-[120px] truncate" title={val(l.after_data?.[c])}>{c === "—" ? "" : val(l.after_data?.[c])}</TableCell></TableRow>))}
      </TableBody></Table>)}
    {master && <Link href={`/auditoria?tab=alteracoes&entity=${receivableId}`} className="mt-2 inline-block text-[12px] text-action hover:underline">Ver auditoria completa</Link>}
  </section>
);
```

- [ ] **Passo 3: Verificar tipos** (`npm run typecheck`)

- [ ] **Passo 4: Commit**

```bash
git add src/components/cobrancas/historico.tsx
git commit -m "feat: migra Historico para Table do shadcn"
```

---

## Task 5: Migrar `drawer-cobranca.tsx` de `Drawer` customizado para `Sheet` do shadcn

**Files:** Modify: `src/components/cobrancas/drawer-cobranca.tsx`

O componente customizado `Drawer` (`src/components/ui/drawer.tsx`) tinha a API `aberto`/`titulo`/`subtitulo`/`onFechar`/`children`. O `Sheet` do shadcn usa `open`/`onOpenChange` (padrão Base UI `Dialog`). O conteúdo interno (identificação, financeiro, `FormOperacional`, `AcoesMaster`, `Historico`) NÃO muda nesta task — só a casca (`Drawer`→`Sheet`).

- [ ] **Passo 1: Confirmar o arquivo real** (`cat src/components/cobrancas/drawer-cobranca.tsx`)

- [ ] **Passo 2: Trocar só o import e o wrapper externo** — de:

```tsx
import { Drawer } from "@/components/ui/drawer";
```

para:

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
```

E trocar:

```tsx
  return (
    <Drawer aberto={!!r} titulo={r?.project_name ?? ""} subtitulo={r ? `${fmtCompetenciaLonga(r.competence)} · ${r.hub}` : undefined} onFechar={fechar}>
      {r && (<div className="space-y-6">
        {/* ...conteúdo... */}
      </div>)}
    </Drawer>
  );
```

por:

```tsx
  return (
    <Sheet open={!!r} onOpenChange={(open) => !open && fechar()}>
      <SheetContent className="w-full gap-0 sm:max-w-[640px]">
        {r && (<>
          <SheetHeader className="border-b border-line">
            <SheetTitle>{r.project_name}</SheetTitle>
            <SheetDescription>{fmtCompetenciaLonga(r.competence)} · {r.hub}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
            {/* ...conteúdo idêntico ao que já existe, só reindentado dentro da nova estrutura... */}
          </div>
        </>)}
      </SheetContent>
    </Sheet>
  );
```

**Importante:** todo o conteúdo interno (as duas `<section>` de Identificação/Financeiro, `<FormOperacional>`, `{master && <AcoesMaster>}`, `<Historico>`) continua EXATAMENTE como está — só muda a casca externa (`Drawer`→`Sheet`) e o wrapper de conteúdo (a `div.space-y-6` original vira a `div.flex-1.space-y-6.overflow-y-auto.px-5.py-4` dentro do `SheetContent`, já que o scroll agora é responsabilidade desse wrapper, não do `Sheet` em si).

- [ ] **Passo 3: Verificar tipos** (`npm run typecheck`)

- [ ] **Passo 4: Teste visual e funcional** — `/cobrancas`, clicar numa linha da tabela pra abrir o painel lateral. Confirmar: painel desliza da direita, título/subtítulo corretos, todo o conteúdo (identificação, financeiro, formulário operacional, histórico) aparece igual a antes, botão de fechar (X, já incluso no `SheetContent`) funciona, clicar fora (overlay) fecha, a URL perde o parâmetro `?receivable=` ao fechar (mesma lógica de `fechar()`, não mudou).

- [ ] **Passo 5: Commit**

```bash
git add src/components/cobrancas/drawer-cobranca.tsx
git commit -m "feat: migra DrawerCobranca de Drawer customizado para Sheet do shadcn"
```

---

## Task 6: Migrar `novo-projeto.tsx` para shadcn + react-hook-form

**Files:** Modify: `src/components/cobrancas/novo-projeto.tsx`

`criarProjeto` (em `src/services/receivablesActions.ts`) já usa o schema zod `projeto` (`name` min 2, `stage_code` enum nullable, `project_status` enum, `hub` enum, `ministry_government`/`institute`/`foundation` nullable, `origin` enum, `provisional` boolean, `notes` nullable) — **exporte esse schema** (hoje é `const projeto = z.object(...)`, não exportado) pra reusar no cliente.

- [ ] **Passo 1: Confirmar os arquivos reais** (`cat src/components/cobrancas/novo-projeto.tsx`, `cat src/services/receivablesActions.ts`)

- [ ] **Passo 2: Exportar o schema `projeto` de `receivablesActions.ts`** — troque só a linha `const projeto = z.object(...)` por `export const projetoSchema = z.object(...)` (mesmo conteúdo), e ajuste a única referência interna (`projeto.parse`/`safeParse` dentro de `criarProjeto`) pro novo nome. Não precisa criar um arquivo novo em `src/lib/schemas/` pra este — `criarProjeto` já mora em `receivablesActions.ts` junto com o schema, then é aceitável exportar direto de lá (padrão já usado por `NovoRecebivelInput`/`ProjetoInput`, que também são exportados desse mesmo arquivo).

- [ ] **Passo 3: Reescrever `novo-projeto.tsx`**

```tsx
"use client";
import { useTransition } from "react";
import { Plus } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Erro } from "@/components/ui/basicos";
import { criarProjeto, projetoSchema, type ProjetoInput } from "@/services/receivablesActions";
import { ORIGIN_LABEL, STATUS_LABEL } from "@/types/domain";

const FASES = ["A", "B", "C", "D"] as const;

export const NovoProjeto = () => {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const form = useForm<ProjetoInput>({ resolver: zodResolver(projetoSchema), defaultValues: { name: "", stage_code: "A", project_status: "active", hub: "IFES", ministry_government: "", institute: "", foundation: "", origin: "crm", provisional: true, notes: "" } });

  const onValid = (f: ProjetoInput) => start(async () => {
    const r = await criarProjeto({ ...f, ministry_government: f.ministry_government || null, institute: f.institute || null, foundation: f.foundation || null, notes: f.notes || null });
    if (!r.ok) { setErro(r.erro); return; }
    setErro(null); setAberto(false); form.reset();
  });

  return (<>
    <Button size="sm" onClick={() => setAberto(true)}><Plus size={13} /> Novo projeto</Button>
    <Modal aberto={aberto} titulo="Cadastrar projeto" onFechar={() => setAberto(false)}>
      <form onSubmit={form.handleSubmit(onValid)}>
        <FieldGroup className="grid grid-cols-2 gap-3">
          <Controller control={form.control} name="name" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error} className="col-span-2"><FieldLabel htmlFor={field.name}>Projeto</FieldLabel><Input id={field.name} aria-invalid={!!fieldState.error} {...field} /><FieldError errors={[fieldState.error]} /></Field>
          )} />
          <Controller control={form.control} name="stage_code" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Fase do projeto</FieldLabel>
              <Select value={field.value ?? "__pendente__"} onValueChange={(v) => field.onChange(v === "__pendente__" ? null : v)}>
                <SelectTrigger id={field.name} className="w-full" aria-invalid={!!fieldState.error}><SelectValue>{(v: string) => (v === "__pendente__" ? "Pendente" : v)}</SelectValue></SelectTrigger>
                <SelectContent>{FASES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}<SelectItem value="__pendente__">Pendente</SelectItem></SelectContent>
              </Select>
              <FieldError errors={[fieldState.error]} /></Field>
          )} />
          <Controller control={form.control} name="project_status" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Situação</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={field.name} className="w-full" aria-invalid={!!fieldState.error}><SelectValue>{(v: keyof typeof STATUS_LABEL) => STATUS_LABEL[v]}</SelectValue></SelectTrigger>
                <SelectContent>{(["active", "backlog", "lost"] as const).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
              </Select>
              <FieldError errors={[fieldState.error]} /></Field>
          )} />
          <Controller control={form.control} name="hub" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>HUB</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={field.name} className="w-full" aria-invalid={!!fieldState.error}><SelectValue>{(v: string) => v}</SelectValue></SelectTrigger>
                <SelectContent><SelectItem value="IFES">IFES</SelectItem><SelectItem value="GOV">GOV</SelectItem></SelectContent>
              </Select>
              <FieldError errors={[fieldState.error]} /></Field>
          )} />
          <Controller control={form.control} name="ministry_government" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Ministério / Governo</FieldLabel><Input id={field.name} aria-invalid={!!fieldState.error} {...field} value={field.value ?? ""} /><FieldError errors={[fieldState.error]} /></Field>
          )} />
          <Controller control={form.control} name="institute" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Instituto</FieldLabel><Input id={field.name} aria-invalid={!!fieldState.error} {...field} value={field.value ?? ""} /><FieldError errors={[fieldState.error]} /></Field>
          )} />
          <Controller control={form.control} name="foundation" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Fundação</FieldLabel><Input id={field.name} aria-invalid={!!fieldState.error} {...field} value={field.value ?? ""} /><FieldError errors={[fieldState.error]} /></Field>
          )} />
          <Controller control={form.control} name="origin" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Origem</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={field.name} className="w-full" aria-invalid={!!fieldState.error}><SelectValue>{(v: keyof typeof ORIGIN_LABEL) => ORIGIN_LABEL[v]}</SelectValue></SelectTrigger>
                <SelectContent>{Object.entries(ORIGIN_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
              <FieldError errors={[fieldState.error]} /></Field>
          )} />
          <Controller control={form.control} name="provisional" render={({ field }) => (
            <label className="flex items-center gap-2 self-end pb-2 text-[12px]"><input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />Provisório (CRM / pré-base)</label>
          )} />
          <Controller control={form.control} name="notes" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error} className="col-span-2"><FieldLabel htmlFor={field.name}>Observação</FieldLabel><Textarea id={field.name} aria-invalid={!!fieldState.error} {...field} value={field.value ?? ""} /><FieldError errors={[fieldState.error]} /></Field>
          )} />
        </FieldGroup>
        <p className="mt-2 text-[11px] text-ink-faint">Após criar o projeto, abra qualquer recebível dele (ou use &quot;Criar nova parcela&quot;) para cadastrar as competências previstas.</p>
        <Erro msg={erro} /><div className="mt-4 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setAberto(false)}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? "Criando…" : "Criar projeto"}</Button></div>
      </form>
    </Modal>
  </>);
};
```

**Atenção:** o `useState` de `aberto`/`erro` continua (controle do Modal, não é campo de formulário) — só os campos do formulário migraram pra `Controller`. Não esqueça o `import { useState } from "react";` junto com `useTransition`. `stage_code` usa o mesmo padrão de valor-sentinela (`"__pendente__"`) que `SelectFiltro` usa pra "Todos", porque `null` também não é um `value` válido de `SelectItem`.

- [ ] **Passo 4: Verificar tipos** (`npm run typecheck` — sem erro novo)

- [ ] **Passo 5: Testar manualmente** — `/cobrancas`, clicar "Novo projeto", submeter vazio (nome com 1 caractere) → erro client-side. Preencher válido → cria, modal fecha, projeto aparece na lista após o filtro certo.

- [ ] **Passo 6: Commit**

```bash
git add src/components/cobrancas/novo-projeto.tsx src/services/receivablesActions.ts
git commit -m "feat: migra NovoProjeto para shadcn + react-hook-form"
```

---

## Task 7: Migrar `form-operacional.tsx` para shadcn (mantendo a lógica de diff/conflito)

**Files:** Modify: `src/components/cobrancas/form-operacional.tsx`

Este formulário tem uma UX própria: mostra um resumo de diffs antes de confirmar o salvamento, e trata conflito de edição concorrente (outro usuário alterou o recebível enquanto este formulário estava aberto). **Não simplifique essa lógica** — só troca os componentes visuais (`<select>`/`<input>`/`<textarea>` nativos → `Select`/`Input`/`Textarea` do shadcn, `.tbl` → `Table`), mantendo a fonte de dados como `useState` (não há uma regra de validação real aqui além de "algum campo mudou" — não faz sentido forçar um `zodResolver` só por uniformidade; o valor do react-hook-form aqui seria só de wiring de componente, e o `useState` atual já cumpre bem esse papel, então mantenha como está).

- [ ] **Passo 1: Confirmar o arquivo real** (`cat src/components/cobrancas/form-operacional.tsx`)

- [ ] **Passo 2: Trocar os campos nativos pelos componentes shadcn**, mantendo `useState<Valores>`, `up()`, `diffs`, `salvar()`, `conflito` EXATAMENTE como estão — só a camada de apresentação dos campos muda:

```tsx
"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Erro } from "@/components/ui/basicos";
import { fmtData, fmtDataHora } from "@/lib/format";
import { salvarOperacional, type ConflitoInfo } from "@/services/receivablesActions";
import type { CollectionStatus, Profile, Receivable } from "@/types/domain";

interface Valores { collection_status_id: string; responsible_user_id: string; responsible_legacy_name: string; operational_deadline: string; reason: string; action: string }
const deRecebivel = (r: Receivable): Valores => ({ collection_status_id: r.collection_status_id ?? "", responsible_user_id: r.responsible_user_id ?? "", responsible_legacy_name: r.responsible_legacy_name ?? "", operational_deadline: r.operational_deadline ?? "", reason: r.reason ?? "", action: r.action ?? "" });

export const FormOperacional = ({ r, etapas, perfis, perfilAtual, podeEditar, onSalvo }: { r: Receivable; etapas: CollectionStatus[]; perfis: Profile[]; perfilAtual: Profile; podeEditar: boolean; onSalvo: () => void }) => {
  const original = deRecebivel(r);
  const [v, setV] = useState<Valores>(original);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conflito, setConflito] = useState<ConflitoInfo | null>(null);
  const [registrado, setRegistrado] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof Valores>(k: K) => (val: Valores[K]) => setV((s) => ({ ...s, [k]: val }));

  const rotEtapa = (id: string) => etapas.find((e) => e.id === id)?.display_label ?? "—";
  const rotResp = (id: string, legado: string) => perfis.find((p) => p.user_id === id)?.full_name ?? legado ?? "—";
  const diffs: { campo: string; antes: string; depois: string }[] = [];
  if (v.collection_status_id !== original.collection_status_id) diffs.push({ campo: "Etapa da cobrança", antes: rotEtapa(original.collection_status_id), depois: rotEtapa(v.collection_status_id) });
  if (v.responsible_user_id !== original.responsible_user_id || v.responsible_legacy_name !== original.responsible_legacy_name) diffs.push({ campo: "Responsável", antes: rotResp(original.responsible_user_id, original.responsible_legacy_name), depois: rotResp(v.responsible_user_id, v.responsible_legacy_name) });
  if (v.operational_deadline !== original.operational_deadline) diffs.push({ campo: "Prazo", antes: fmtData(original.operational_deadline), depois: fmtData(v.operational_deadline) });
  if (v.reason !== original.reason) diffs.push({ campo: "Motivo", antes: original.reason || "—", depois: v.reason || "—" });
  if (v.action !== original.action) diffs.push({ campo: "Ação", antes: original.action || "—", depois: v.action || "—" });

  const salvar = () => start(async () => {
    const res = await salvarOperacional({ id: r.id, expected_version: r.source_version, collection_status_id: v.collection_status_id || null, responsible_user_id: v.responsible_user_id || null, responsible_legacy_name: v.responsible_user_id ? null : (v.responsible_legacy_name || null), operational_deadline: v.operational_deadline || null, reason: v.reason || null, action: v.action || null });
    setConfirmando(false);
    if (!res.ok) { setErro(res.erro); if (res.conflito) setConflito(res.conflito); return; }
    setErro(null); setRegistrado(`Atualização registrada por ${perfilAtual.full_name} em ${fmtDataHora(new Date().toISOString())}.`); onSalvo();
  });
  const opcoesHub = etapas.filter((e) => e.hub === r.hub);
  const SEM_ETAPA = "__sem-etapa__", SEM_RESP = "__sem-responsavel__";

  return (
    <section className="space-y-3">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Acompanhamento operacional</h3>
      <div className="flex flex-col gap-0.5">
        <Label>Etapa da cobrança</Label>
        <Select value={v.collection_status_id || SEM_ETAPA} onValueChange={(val) => set("collection_status_id")(val === SEM_ETAPA ? "" : val)} disabled={!podeEditar}>
          <SelectTrigger className="w-full"><SelectValue>{(val: string) => (val === SEM_ETAPA ? "—" : opcoesHub.find((e) => e.id === val)?.display_label ?? val)}</SelectValue></SelectTrigger>
          <SelectContent><SelectItem value={SEM_ETAPA}>—</SelectItem>{opcoesHub.map((e) => <SelectItem key={e.id} value={e.id}>{e.display_label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5">
          <Label>Responsável (usuário)</Label>
          <Select value={v.responsible_user_id || SEM_RESP} onValueChange={(val) => set("responsible_user_id")(val === SEM_RESP ? "" : val)} disabled={!podeEditar}>
            <SelectTrigger className="w-full"><SelectValue>{(val: string) => (val === SEM_RESP ? "— (usar nome livre)" : perfis.find((p) => p.user_id === val)?.full_name ?? val)}</SelectValue></SelectTrigger>
            <SelectContent><SelectItem value={SEM_RESP}>— (usar nome livre)</SelectItem>{perfis.filter((p) => p.active).map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-0.5">
          <Label>Responsável (nome livre)</Label>
          <Input value={v.responsible_legacy_name} onChange={(e) => set("responsible_legacy_name")(e.target.value)} disabled={!podeEditar || !!v.responsible_user_id} placeholder="Usado se nenhum usuário for selecionado" />
        </div>
      </div>
      <div className="flex flex-col gap-0.5 w-[160px]"><Label>Prazo</Label><Input type="date" value={v.operational_deadline} onChange={(e) => set("operational_deadline")(e.target.value)} disabled={!podeEditar} /></div>
      <div className="flex flex-col gap-0.5"><Label>Motivo</Label><Textarea className="h-16" value={v.reason} onChange={(e) => set("reason")(e.target.value)} disabled={!podeEditar} /></div>
      <div className="flex flex-col gap-0.5"><Label>Ação</Label><Textarea className="h-16" value={v.action} onChange={(e) => set("action")(e.target.value)} disabled={!podeEditar} /></div>

      {conflito && (
        <div className="rounded border border-danger/30 bg-danger-soft p-3 text-[12px]">
          <p className="font-semibold text-danger">Outra pessoa alterou este recebível enquanto você editava.</p>
          <p className="mt-1 text-ink-muted">Versão que você abriu: {r.source_version} · versão atual: {conflito.current_version} · atualizado em {fmtDataHora(String(conflito.current.updated_at))}.</p>
          <Table className="mt-2"><TableHeader><TableRow><TableHead>Campo</TableHead><TableHead>Você abriu</TableHead><TableHead>Atual no sistema</TableHead><TableHead>Você tentou salvar</TableHead></TableRow></TableHeader><TableBody>
            {[["Etapa", rotEtapa(original.collection_status_id), rotEtapa(String(conflito.current.collection_status_id ?? "")), rotEtapa(v.collection_status_id)], ["Prazo", fmtData(original.operational_deadline), fmtData(conflito.current.operational_deadline as string), fmtData(v.operational_deadline)], ["Motivo", original.reason || "—", String(conflito.current.reason ?? "—"), v.reason || "—"], ["Ação", original.action || "—", String(conflito.current.action ?? "—"), v.action || "—"]].map(([c, a, b, d]) => <TableRow key={c}><TableCell>{c}</TableCell><TableCell>{a}</TableCell><TableCell className="font-medium">{b}</TableCell><TableCell>{d}</TableCell></TableRow>)}
          </TableBody></Table>
          <div className="mt-2 flex gap-2"><Button size="sm" variant="outline" onClick={() => { setConflito(null); onSalvo(); }}>Recarregar com a versão atual</Button></div>
        </div>
      )}
      <Erro msg={erro} />
      {registrado && <p className="text-[12px] text-ok">{registrado}</p>}
      {podeEditar && !confirmando && <Button onClick={() => diffs.length ? setConfirmando(true) : setErro("Nenhum campo foi alterado.")} disabled={pending || !!conflito}>Salvar atualização</Button>}
      {confirmando && (
        <div className="rounded border border-line bg-canvas p-3">
          <p className="mb-2 text-[12px] font-semibold">Confirme as alterações</p>
          <Table><TableHeader><TableRow><TableHead>Campo</TableHead><TableHead>Antes</TableHead><TableHead>Depois</TableHead></TableRow></TableHeader><TableBody>{diffs.map((d) => <TableRow key={d.campo}><TableCell>{d.campo}</TableCell><TableCell className="whitespace-normal text-ink-muted">{d.antes}</TableCell><TableCell className="whitespace-normal font-medium">{d.depois}</TableCell></TableRow>)}</TableBody></Table>
          <div className="mt-3 flex gap-2"><Button onClick={salvar} disabled={pending}>{pending ? "Salvando…" : "Confirmar e salvar"}</Button><Button variant="outline" onClick={() => setConfirmando(false)}>Voltar</Button></div>
        </div>
      )}
    </section>
  );
};
```

Note: os 2 `Select` (Etapa/Responsável) usam valor-sentinela (`SEM_ETAPA`/`SEM_RESP`) pro mesmo motivo já visto em `SelectFiltro`/`novo-projeto.tsx` — `""` não é um `value` válido de `SelectItem`. A lógica de `diffs`/`salvar`/`conflito` é BYTE A BYTE a mesma, só a função `up()` foi renomeada pra `set()` (curried, mais direta de usar com `Select`'s `onValueChange` que já entrega o valor, não um evento) — se preferir manter `up` como estava (recebendo `ChangeEvent`) e só criar uma função separada pros `Select`s, tanto faz, o importante é não mudar o comportamento de `diffs`/`salvar`.

- [ ] **Passo 3: Verificar tipos e nenhum resíduo de `.tbl`/`className="field"`** (`npm run typecheck` + `grep -n 'className="tbl"\|className="field' src/components/cobrancas/form-operacional.tsx` vazio)

- [ ] **Passo 4: Testar manualmente** — abrir um recebível (logado como `operator` ou `master_admin`), mudar a Etapa e o Prazo, clicar "Salvar atualização" → tela de confirmação mostra o diff (Etapa/Prazo, "Antes"/"Depois" corretos), confirmar → salva, mensagem de sucesso aparece. Testar também o cenário sem nenhuma mudança (botão deve mostrar erro "Nenhum campo foi alterado.").

- [ ] **Passo 5: Commit**

```bash
git add src/components/cobrancas/form-operacional.tsx
git commit -m "feat: migra FormOperacional para shadcn, preservando logica de diff e conflito"
```

---

## Task 8: Verificação final do sub-projeto

**Files:** nenhum (task de verificação)

- [ ] **Passo 1: Rodar a suite**

```bash
npm run lint
npm run typecheck
npm run test
```

Nenhum arquivo tocado por este plano deve aparecer no `typecheck`. Os únicos erros restantes no projeto devem ser em `src/components/cobrancas/acoes-master.tsx` (último sub-projeto, ainda não iniciado).

- [ ] **Passo 2: Teste manual completo** — fluxo inteiro em `/cobrancas`: filtros rápidos, filtros completos, tabela (ordenação, rolagem horizontal com colunas fixas), paginação, abrir um recebível (Sheet), editar operacional (diff/confirmação), criar novo projeto, histórico.

Não iniciar o próximo sub-projeto (Ações do Master Admin) automaticamente — plano novo, escrito separadamente.
