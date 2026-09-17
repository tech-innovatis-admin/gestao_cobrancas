# Remanejamento do Frontend — Fase 1 (tipografia, navbar, busca) — Implementation Plan

**Status:** ✅ Aprovado pelo usuário — pronto para abrir branch e implementar.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Primeira leva do remanejamento visual pedido pelo usuário: (1) trocar a fonte do projeto para Montserrat, (2) padronizar títulos em CAIXA ALTA (e centralizar os títulos de painel/tabela/gráfico) em todo o sistema, (3) limpar o navbar (remover e-mail, renomear "Visão Geral" → "Visão Executiva"), e (4) adicionar autocomplete de projetos no campo de busca da Visão Geral, com largura fixa, posicionado acima dos demais filtros, dropdown abaixo do campo, navegando para Cobranças ao selecionar.

**Architecture:** Sem mudança de arquitetura — tudo client-side/CSS ou extensão de query já existente. O autocomplete de projetos reaproveita o mesmo padrão de `opcoesDeFiltro()` (`src/services/receivablesService.ts`) já usado para `fundacoes`/`institutos`/`ministerios`, e o link de navegação reaproveita o padrão já existente em `docs/superpowers/plans/2026-09-09-auditoria-migracao-shadcn.md` (`/cobrancas?q=<nome>&status=all`). Nenhuma RPC nova, nenhuma migration, nenhuma Edge Function tocada — fora do escopo definido em `CLAUDE.md`.

**Tech Stack:** Next.js 15, React 19, Tailwind v4 (`@utility` em `globals.css`), `next/font/google`. Nenhuma dependência nova — o dropdown de autocomplete é construído com `Input` + lista simples (mesmo espírito de `SelectFiltro`/`BuscaFiltro` em `src/components/filtros/campos.tsx`), sem adicionar `Popover`/`Command` do shadcn (evita dependência nova para um componente pequeno; se o usuário preferir o primitive do shadcn, é uma troca isolada depois).

**Regra do projeto (sem exceção):** nenhuma mensagem de commit criada a partir deste plano deve conter linha de atribuição a IA. PR sempre para `develop`, nunca para `main`.

**Decisões confirmadas com o usuário (não repetir pergunta):**
- Caixa alta + centralizado em `panel-title` vale para o **sistema todo** (Auditoria e Cobranças também), não só Visão Geral.
- "Letra maiúscula" (TODO geral) e "caixa alta" (Visão Geral) são a mesma regra: tudo em CAIXA ALTA.
- Dropdown do campo de busca: ao clicar num projeto sugerido, navega direto para `/cobrancas` filtrado por aquele projeto.
- Novo nome do item de menu "Visão Geral": **"Visão Executiva"**. A rota (`/visao-geral`) não muda — só o texto visível (label do menu e título no topbar).
- Fonte "Montesserat" = **Montserrat** (Google Fonts).
- Autocomplete de projetos também em **Cobranças** (não só Visão Geral), com componente compartilhado — em Cobranças o clique filtra a própria tela (não navega), em Visão Geral navega para `/cobrancas`.
- Botões de atalho de `filtros-rapidos.tsx` (Cobranças) e abas de Auditoria (`TabsTrigger`) também em CAIXA ALTA, por consistência ("tudo no padrão").

---

## Pré-requisitos confirmados (não repetir)

- `--font-sans` é definida em um único lugar (`src/app/globals.css:10`), apontando pra `--font-inter` gerada em `src/app/layout.tsx:2-7` — trocar a fonte é mudança em 2 arquivos, sem tocar em mais nada.
- `.panel-title` (`globals.css:81-83`) é usada em `graficos.tsx`, `consolidado.tsx`, e nas telas de Auditoria (`alteracoes.tsx`, `qualidade.tsx`, `sincronizacoes.tsx`, `usuarios.tsx`) e Cobranças (`tabela.tsx`) — mudar essa classe afeta todas essas telas (intencional, confirmado com o usuário).
- `TabelaGerencial` (`tabelas-gerenciais.tsx`) **não** usa `.panel-title` — tem um cabeçalho colorido próprio (`bg-danger`/`bg-ok`) com título à esquerda e contador à direita. Precisa de tratamento manual pra ficar visualmente consistente com o resto (caixa alta + centralizado), sem perder o contador.
- `opcoesDeFiltro()` (`receivablesService.ts:78-83`) já consulta `v_receivables_enriched` com `select(...)` e monta listas únicas via `uniq()` — vamos estender o mesmo `select` e adicionar `projetos` (id + nome, deduplicado) na mesma função, sem query nova.
- O campo de busca atual (`BuscaFiltro` em `campos.tsx:29-39`) é só um `Input` com debounce de 400ms escrevendo na URL (`q`) — não existe autocomplete hoje. Vamos criar um componente novo (`BuscaProjetoFiltro`) especificamente pra Visão Geral, sem alterar o `BuscaFiltro` genérico (que continua usado como está em Cobranças/Auditoria).

---

## Task 1: Trocar a fonte do projeto para Montserrat

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Passo 1: Confirmar os arquivos reais** (`src/app/layout.tsx`, trecho de `--font-sans` em `globals.css`)
- [ ] **Passo 2: Trocar o import da fonte**
```tsx
import { Montserrat } from "next/font/google";
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });
// className={montserrat.variable} no <html>
```
- [ ] **Passo 3: Atualizar `globals.css`** — `--font-sans: var(--font-montserrat), system-ui, sans-serif;`
- [ ] **Passo 4: Verificar tipos** (`npm run typecheck`)
- [ ] **Passo 5: Teste visual** — subir `npm run dev`, confirmar que a fonte mudou em toda a aplicação (login, sidebar, tabelas)
- [ ] **Passo 6: Commit**
```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat(ui): troca fonte do projeto de Inter para Montserrat"
```

---

## Task 2: Padronizar títulos em CAIXA ALTA (sistema todo) e centralizar títulos de painel

**Files:**
- Modify: `src/app/globals.css` (`.panel-title`, `.panel-head`)
- Modify: `src/components/layout/topbar.tsx` (título da página)
- Modify: `src/components/layout/sidebar.tsx` (itens de menu)
- Modify: `src/components/visao-geral/tabelas-gerenciais.tsx` (título custom, sem `.panel-title`)
- Modify: `src/components/cobrancas/filtros-rapidos.tsx` (botões de atalho)
- Modify: `src/app/(app)/auditoria/page.tsx` (abas `TabsTrigger`)

Transformação **só visual** (CSS `uppercase`/`text-align: center`), sem alterar as strings em português no código (mantém acentuação/legibilidade em `aria-label`, `title`, links, etc.).

- [ ] **Passo 1: Confirmar os 4 arquivos reais**
- [ ] **Passo 2: `globals.css`** — atualizar `panel-head`/`panel-title` pra suportar título centralizado mantendo espaço pra conteúdo secundário (contador em `tabelas-gerenciais.tsx`, subtítulo em `consolidado.tsx`):
```css
@utility panel-head {
  @apply grid grid-cols-[1fr_auto_1fr] items-center border-b border-line px-4 py-2.5;
}
@utility panel-title {
  @apply col-start-2 text-center text-[13px] font-semibold uppercase tracking-wide;
}
```
  (o conteúdo secundário que hoje fica ao lado do título — ex.: subtítulo do Consolidado — passa a ocupar a 3ª coluna do grid, alinhado à direita; ver Task 3 do Consolidado abaixo se precisar ajustar o JSX que usa `panel-head`/`panel-title` diretamente.)
- [ ] **Passo 3: `topbar.tsx`** — título da página em caixa alta: `<h1 className="text-[16px] font-semibold text-foreground uppercase tracking-wide">{titulo}</h1>`
- [ ] **Passo 4: `sidebar.tsx`** — itens de menu em caixa alta: adicionar `uppercase tracking-wide` na classe do `Link` (mantendo o restante do estilo)
- [ ] **Passo 5: `tabelas-gerenciais.tsx`** — título do cabeçalho colorido em caixa alta e centralizado, mantendo o contador à direita (mesma lógica de grid 3 colunas da Task acima, ou `flex` com `flex-1 text-center` no título)
- [ ] **Passo 6: `filtros-rapidos.tsx`** — adicionar `uppercase tracking-wide` na classe do `Button` de cada atalho (só neste arquivo — o componente `Button` compartilhado não muda, pra não afetar botões de formulário/diálogo em todo o resto do sistema)
- [ ] **Passo 7: `auditoria/page.tsx`** — adicionar `className="uppercase tracking-wide"` no `TabsTrigger` (só nesta página — o primitive `ui/tabs.tsx` fica genérico, sem essa classe embutida, caso ganhe outro uso no futuro)
- [ ] **Passo 8: Verificar tipos** (`npm run typecheck`)
- [ ] **Passo 9: Teste visual** — conferir Visão Geral, Cobranças e Auditoria: sidebar, topbar, todos os painéis (`Consolidado Mensal`, `Recebíveis em Atraso`/`A Vencer`, gráficos, fila de sincronização, qualidade, usuários), botões de atalho de Cobranças e abas de Auditoria em caixa alta e centralizados, sem quebrar o contador/subtítulo de nenhum painel
- [ ] **Passo 10: Commit**
```bash
git add src/app/globals.css src/components/layout/topbar.tsx src/components/layout/sidebar.tsx src/components/visao-geral/tabelas-gerenciais.tsx src/components/cobrancas/filtros-rapidos.tsx "src/app/(app)/auditoria/page.tsx"
git commit -m "feat(ui): padroniza titulos, paineis, atalhos e abas em caixa alta e centralizados"
```

---

## Task 3: Navbar — remover e-mail e renomear "Visão Geral" para "Visão Executiva"

**Files:**
- Modify: `src/components/layout/topbar.tsx`
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/app/(app)/visao-geral/page.tsx` (prop `titulo` do `Topbar`)

- [ ] **Passo 1: Confirmar os 3 arquivos reais**
- [ ] **Passo 2: `topbar.tsx`** — remover `{perfil.email} · ` da linha de identificação do usuário, mantendo `{ROLE_LABEL[perfil.role]}`
- [ ] **Passo 3: `sidebar.tsx`** — trocar `label: "Visão Geral"` por `label: "Visão Executiva"` no item de menu (`href` continua `/visao-geral`, sem mudar rota)
- [ ] **Passo 4: `visao-geral/page.tsx`** — trocar `titulo="Visão Geral"` por `titulo="Visão Executiva"` no `<Topbar>`
- [ ] **Passo 5: Verificar tipos** (`npm run typecheck`)
- [ ] **Passo 6: Teste visual** — confirmar que o e-mail sumiu do topbar em todas as telas, e que o menu/topbar mostram "Visão Executiva" (em caixa alta, pela Task 2) sem quebrar links
- [ ] **Passo 7: Commit**
```bash
git add src/components/layout/topbar.tsx src/components/layout/sidebar.tsx "src/app/(app)/visao-geral/page.tsx"
git commit -m "feat(ui): remove e-mail do navbar e renomeia Visao Geral para Visao Executiva"
```

---

## Task 4: Autocomplete de projetos no campo de busca (Visão Geral e Cobranças)

**Files:**
- Modify: `src/services/receivablesService.ts` (estender `opcoesDeFiltro`)
- Create: `src/components/filtros/busca-projeto.tsx` (novo componente `BuscaProjetoFiltro`, compartilhado pelas 2 telas)
- Modify: `src/components/visao-geral/filtros-globais.tsx` (usar o novo componente, reposicionar acima dos demais filtros, clique navega para Cobranças)
- Modify: `src/components/cobrancas/filtros-cobrancas.tsx` (usar o novo componente no lugar do `BuscaFiltro` de projeto, reposicionar acima dos demais filtros, clique filtra a própria tela)

- [ ] **Passo 1: Confirmar os arquivos reais**
- [ ] **Passo 2: Estender `opcoesDeFiltro()`** — incluir `project_id, project_name` no `select`, deduplicar por `project_id` e devolver `projetos: { id: string; nome: string }[]` ordenado por nome. Atualizar a interface `OpcoesFiltro` em `filtros-globais.tsx` (ela já é reaproveitada por `filtros-cobrancas.tsx`, ver import em `filtros-cobrancas.tsx:5`).
- [ ] **Passo 3: Criar `BuscaProjetoFiltro`** (`src/components/filtros/busca-projeto.tsx`, `"use client"`), reutilizável pelas duas telas via prop de callback:
```tsx
export const BuscaProjetoFiltro = ({ projetos, aoSelecionar }: { projetos: { id: string; nome: string }[]; aoSelecionar: (nome: string) => void }) => { /* ... */ };
```
  - `Input` de texto com largura fixa (ex.: `w-[320px]`, não `min-w`)
  - Ao digitar, filtra a lista `projetos` recebida via prop (client-side, sem nova consulta — mesma filosofia dos outros filtros que já carregam a lista inteira)
  - Mostra dropdown **abaixo do campo** (`absolute top-full left-0 mt-1`) com até ~8 resultados; texto "Digite para buscar" quando vazio e "Nenhum projeto encontrado" quando sem match
  - Navegação por teclado (setas para cima/baixo, Enter seleciona o item destacado, Esc fecha)
  - Ao selecionar (clique ou Enter): chama `aoSelecionar(nome)` — quem decide o que acontece é a tela que usa o componente, não ele mesmo
  - Fecha o dropdown ao clicar fora (`useEffect` com listener de `mousedown`; conferir se já existe um hook parecido no projeto antes de duplicar lógica)
- [ ] **Passo 4: `filtros-globais.tsx`** (Visão Geral) — `<BuscaProjetoFiltro projetos={op.projetos} aoSelecionar={(nome) => router.push(\`/cobrancas?q=${encodeURIComponent(nome)}&status=all\`)} />` (mesmo padrão de link já usado em `docs/superpowers/plans/2026-09-09-auditoria-migracao-shadcn.md`), numa linha própria **acima** do `<div className="panel flex flex-wrap items-end gap-2.5 ...">` atual
- [ ] **Passo 5: `filtros-cobrancas.tsx`** — mesma posição (linha própria acima do painel de filtros), mas `aoSelecionar={(nome) => set({ q: nome, status: "all" })}` usando o `useUrlFiltros` já importado nos outros campos (filtra a própria tela, sem navegar); remove o `<BuscaFiltro rotulo="Busca" .../>` de projeto que existia ali (linha 15), já substituído pelo novo componente
- [ ] **Passo 6: Verificar tipos** (`npm run typecheck`)
- [ ] **Passo 7: Teste visual** — nas duas telas, digitar parte de um nome de projeto real, conferir dropdown abaixo do campo e navegação por teclado; na Visão Geral confirmar que navega para `/cobrancas` filtrado; em Cobranças confirmar que filtra a própria lista sem sair da página
- [ ] **Passo 8: Commit**
```bash
git add src/services/receivablesService.ts src/components/filtros/busca-projeto.tsx src/components/visao-geral/filtros-globais.tsx src/components/cobrancas/filtros-cobrancas.tsx
git commit -m "feat(filtros): adiciona autocomplete de projetos na Visao Geral e em Cobrancas"
```

---

## Depois de todas as tasks

- [ ] `npm run lint` / `npm run typecheck` / `npm run test` / `npm run build` limpos (mesmo conjunto do CI, `.github/workflows/ci.yml`)
- [ ] Push da branch de feature (a partir de `develop`) e abertura de PR **contra `develop`** (nunca `main`)
