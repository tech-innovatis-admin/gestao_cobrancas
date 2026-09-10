# Visão Geral — Migração visual para shadcn/ui — Implementation Plan

**Status: ✅ Concluído** (2026-09-10) — commits `a3ff42d`, `6287b8d`, `a91e3d3`. `npm run typecheck`/`lint`/`test` limpos; o único erro restante em todo o projeto está em `src/components/cobrancas/acoes-master.tsx` (último sub-projeto).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar as 3 tabelas HTML (`.tbl`) restantes da tela de Visão Geral pra `Table` do shadcn. É um sub-projeto pequeno: `cards.tsx` (cartões executivos) e `filtros-globais.tsx` já não precisam de nenhuma mudança — `filtros-globais.tsx` só usa `SelectFiltro`/`BuscaFiltro`/`ToggleFiltro`/`LimparFiltros` de `@/components/filtros/campos`, já migrados no sub-projeto Auditoria (Task 1.5); `cards.tsx` não usa nenhum componente do sistema antigo (`Badge`/`Button`/`Tabs`/`.tbl`).

**Architecture:** Mesmo padrão transversal já usado em todo o sub-projeto Auditoria: `.tbl`→`Table`/`TableHeader`/`TableBody`/`TableHead`/`TableRow`/`TableCell` (ver `docs/superpowers/specs/2026-09-09-migracao-visual-completa-design.md`). Nenhuma decisão nova de design — é reaplicação mecânica do padrão já validado 5x (`qualidade.tsx`, `sincronizacoes.tsx`, `alteracoes.tsx` ×2, e outras).

**Tech Stack:** Next.js 15, React 19, shadcn/ui `Table` (já instalado).

Este é o 3º dos 5 sub-projetos da migração visual completa (Layout e Auditoria já concluídos) — ver o design doc pra ordem completa.

**Regra do projeto (sem exceção):** nenhuma mensagem de commit criada por este plano deve conter linha de atribuição a IA.

---

## Pré-requisitos confirmados (não repetir)

- `src/components/visao-geral/cards.tsx`: não usa nenhum componente do sistema antigo — **fora de escopo, nenhuma mudança necessária**.
- `src/components/visao-geral/filtros-globais.tsx`: usa só `SelectFiltro`/`BuscaFiltro`/`ToggleFiltro`/`LimparFiltros` (de `@/components/filtros/campos`, já migrados) — **fora de escopo, nenhuma mudança necessária**.
- `src/components/ui/badges-dominio.tsx` (usado por `tabelas-gerenciais.tsx` via `BadgeFase`) já migrado (sub-projeto Auditoria).
- A classe `clicavel` (cursor de linha clicável) já foi promovida pra `@utility` independente em `globals.css` (commit `ba53496`) — funciona corretamente com `TableRow` do shadcn, confirmado em múltiplas tasks anteriores.
- Nenhum destes 3 arquivos tem erro de `npm run typecheck` hoje — a migração é puramente visual (trocar `.tbl` por `Table`), não uma correção de tipo.

---

## Task 1: Migrar a tabela de `graficos.tsx`

**Files:**
- Modify: `src/components/visao-geral/graficos.tsx`

Só a tabela "Top 5 projetos em atraso" (dentro do `Painel`) usa `.tbl` — os gráficos (`recharts`) não são tocados.

- [ ] **Passo 1: Confirmar o arquivo real** (`cat src/components/visao-geral/graficos.tsx`)

- [ ] **Passo 2: Adicionar o import e trocar a tabela**

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
```

```tsx
{g.top5Atraso.length === 0 ? <p className="p-4 text-[12px] text-ink-faint">Nenhum projeto em atraso.</p> :
<Table><TableHeader><TableRow><TableHead>Projeto</TableHead><TableHead className="num">Em atraso</TableHead><TableHead>Competência mais antiga</TableHead></TableRow></TableHeader><TableBody>
  {g.top5Atraso.map((t) => <TableRow key={t.id} className="clicavel"><TableCell className="max-w-[200px] truncate"><Link href={`/cobrancas?receivable=${t.id}`} className="hover:text-action">{t.projeto}</Link></TableCell><TableCell className="num text-danger">{fmtBRL(t.valor)}</TableCell><TableCell>{fmtCompetencia(t.competencia)}</TableCell></TableRow>)}
</TableBody></Table>}
```

- [ ] **Passo 3: Verificar tipos** (`npm run typecheck` — sem erro novo)

- [ ] **Passo 4: Teste visual** — `/visao-geral` (Supabase local + dev server rodando, login `admin@teste.local`/`Teste@123`), confirmar que o painel "Top 5 projetos em atraso" renderiza a tabela nova (ou a mensagem "Nenhum projeto em atraso." se não houver dados de teste), e que os outros gráficos (recharts) continuam intactos.

- [ ] **Passo 5: Commit**

```bash
git add src/components/visao-geral/graficos.tsx
git commit -m "feat: migra tabela de Graficos (Top 5 atraso) para Table do shadcn"
```

---

## Task 2: Migrar a tabela de `tabelas-gerenciais.tsx`

**Files:**
- Modify: `src/components/visao-geral/tabelas-gerenciais.tsx`

- [ ] **Passo 1: Confirmar o arquivo real** (`cat src/components/visao-geral/tabelas-gerenciais.tsx`)

- [ ] **Passo 2: Adicionar o import e trocar a tabela** (mantendo o cabeçalho colorido `bg-danger`/`bg-ok` fora do `Table` — é um `div`, não faz parte da tabela em si):

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
```

```tsx
{rows.length === 0 ? <EmptyState msg={vazio} /> : <div className="max-h-[400px] overflow-auto"><Table><TableHeader><TableRow><TableHead>Mês</TableHead><TableHead>HUB</TableHead><TableHead>Fase</TableHead><TableHead>Projeto</TableHead><TableHead>Etapa</TableHead><TableHead>Responsável</TableHead><TableHead>Prazo</TableHead><TableHead className="num">Saldo Projeto</TableHead><TableHead className="num">Saldo Innovatis</TableHead></TableRow></TableHeader><TableBody>
  {rows.map((r) => <TableRow key={r.id} className="clicavel"><TableCell><Link href={`/cobrancas?receivable=${r.id}`} className="block">{fmtCompetencia(r.competence)}</Link></TableCell><TableCell>{r.hub}</TableCell><TableCell><BadgeFase code={r.stage_code} color={r.stage_color} pending={r.stage_pending} /></TableCell><TableCell className="max-w-[220px] truncate" title={r.project_name}><Link href={`/cobrancas?receivable=${r.id}`} className="hover:text-action">{r.project_name}</Link></TableCell><TableCell className="max-w-[200px] truncate" title={r.collection_status_label ?? ""}>{r.collection_status_label ?? "—"}</TableCell><TableCell>{r.responsible_name ?? "—"}</TableCell><TableCell className={cn(r.deadline_overdue && "text-danger font-medium")}>{fmtData(r.operational_deadline)}</TableCell><TableCell className="num">{fmtBRL(r.balance_project)}</TableCell><TableCell className="num">{fmtBRL(r.balance_innovatis)}</TableCell></TableRow>)}
</TableBody></Table></div>}
```

- [ ] **Passo 3: Verificar tipos** (`npm run typecheck` — sem erro novo)

- [ ] **Passo 4: Teste visual** — `/visao-geral`, confirmar as duas tabelas gerenciais (provavelmente "Em atraso" e "OK", uma com `tom="danger"` outra `tom="ok"` — ver o call-site em `visao-geral/page.tsx` ou onde `TabelaGerencial` é usado) renderizando com o cabeçalho colorido intacto e a tabela nova por baixo.

- [ ] **Passo 5: Commit**

```bash
git add src/components/visao-geral/tabelas-gerenciais.tsx
git commit -m "feat: migra TabelaGerencial para Table do shadcn"
```

---

## Task 3: Migrar a tabela de `consolidado.tsx`

**Files:**
- Modify: `src/components/visao-geral/consolidado.tsx`

- [ ] **Passo 1: Confirmar o arquivo real** (`cat src/components/visao-geral/consolidado.tsx`)

- [ ] **Passo 2: Adicionar o import e trocar a tabela** (atenção: a linha "TOTAL" e as linhas do tipo "Innovatis" têm classes condicionais via `cn(...)` no `<tr>` — preserve isso no `TableRow`):

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
```

```tsx
<div className="max-h-[420px] overflow-auto"><Table><TableHeader><TableRow><TableHead>Mês</TableHead><TableHead>HUB</TableHead><TableHead>Tipo de Valor</TableHead><TableHead className="num">Previsto</TableHead><TableHead className="num">Recebido</TableHead><TableHead className="num">Saldo</TableHead><TableHead className="num">Batimento %</TableHead></TableRow></TableHeader><TableBody>
  {linhas.map((l, i) => <TableRow key={i} className={cn(l.tipo === "Innovatis" && "bg-ok-soft/50!", l.competence === "TOTAL" && "font-semibold border-t-2 border-navy/20")}><TableCell>{l.competence === "TOTAL" ? "TOTAL" : fmtCompetencia(l.competence)}</TableCell><TableCell>{l.hub}</TableCell><TableCell>{l.tipo}</TableCell><TableCell className="num">{fmtBRL(l.previsto)}</TableCell><TableCell className="num">{fmtBRL(l.recebido)}</TableCell><TableCell className={cn("num", l.saldo > 0.01 && "text-danger")}>{fmtBRL(l.saldo)}</TableCell><TableCell className="num">{fmtPct(l.recebido, l.previsto)}</TableCell></TableRow>)}
</TableBody></Table></div>
```

- [ ] **Passo 3: Verificar tipos** (`npm run typecheck` — sem erro novo)

- [ ] **Passo 4: Teste visual** — `/visao-geral`, confirmar a tabela "Consolidado Mensal" com a linha TOTAL em negrito/borda superior e as linhas "Innovatis" com fundo esverdeado sutil, iguais a antes.

- [ ] **Passo 5: Commit**

```bash
git add src/components/visao-geral/consolidado.tsx
git commit -m "feat: migra Consolidado para Table do shadcn"
```

---

## Task 4: Verificação final do sub-projeto Visão Geral

**Files:** nenhum (task de verificação)

- [ ] **Passo 1: Rodar a suite**

```bash
npm run lint
npm run typecheck
npm run test
```

Nenhum arquivo de `src/components/visao-geral/` deve aparecer no `typecheck`. Os únicos erros restantes no projeto todo devem ser os 2 já conhecidos em `src/components/cobrancas/acoes-master.tsx` (sub-projeto final, ainda não iniciado).

- [ ] **Passo 2: Teste manual completo** — `/visao-geral`, conferir cartões executivos, filtros, gráficos e as 3 tabelas migradas nesta leva, tudo funcionando e visualmente consistente com Login/Layout/Auditoria já migrados.

- [ ] **Passo 3: Relatar** se `npm run build` chega mais perto de passar (deve faltar só `acoes-master.tsx`).

Não iniciar o próximo sub-projeto (Cobranças) automaticamente — plano novo, escrito separadamente.
