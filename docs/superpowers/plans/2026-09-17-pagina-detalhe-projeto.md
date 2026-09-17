# Página de detalhe do projeto (rota própria, substitui o drawer) — Implementation Plan

**Status:** ✅ Aprovado pelo usuário — pronto para implementar.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o painel lateral (`DrawerCobranca`, `Sheet`) por uma página de página cheia em `/cobrancas/[id]` (`id` = `project_id`, não o id do recebível), consolidando **todos os recebíveis (competências) de um projeto** numa visão só, com botão "Voltar" usando o histórico do navegador. Mantém a organização em 4 abas (Detalhes, Cobrança, Ações, Histórico), agora todas com URL própria (`?aba=...`).

**Architecture:**
- Um projeto tem N recebíveis (um por competência/mês). O drawer atual mostra só UM recebível; a página nova mostra o PROJETO com a lista de todos os seus recebíveis.
- `obterProjeto(project_id)` já existe (`v_projects_enriched`) — reaproveitado sem mudança.
- Nova função `listarRecebiveisPorProjeto(project_id)` em `receivablesService.ts`, mesmo padrão de `obterRecebivel`/`listarRecebiveisTodos` (consulta direta em `v_receivables_enriched`, sem passar pelo `Filtros`/`aplicar()` genérico — não vale a pena generalizar isso só para este caso).
- Nova função `historicoProjeto(project_id)` em `auditService.ts`, mesmo padrão de `historicoRecebivel`, mas buscando `entity_type='projects' AND entity_id=project_id` OU `entity_type='receivables' AND entity_id IN (recebíveis do projeto)`.
- `AcoesMaster` é dividido por escopo: ações de **projeto** (Editar cadastro, Alterar Fase, Alterar Situação, Excluir da gestão/Restaurar) ficam na aba Ações, operando sobre `project_id`. Ações de **recebível** (Editar valores, Registrar recebimento, Criar nova parcela) migram para dentro da aba Cobrança, por linha da tabela de recebíveis — reaproveitando os mesmos formulários/schemas/actions já existentes (`FormValores`, `FormRecebimento`, `FormParcela`), só trocando de onde são abertos (dialog por linha, não mais dentro do antigo `AcoesMaster`).
- Edição operacional (Etapa/Responsável/Prazo/Motivo/Ação) por recebível: dialog pequeno (`Dialog` do shadcn) abrindo o `FormOperacional` já existente, sem mudar esse componente.
- `DrawerCobranca` (Sheet lateral) é removido; `ListaCobrancas`/`TabelaCobrancas` passam a navegar via `<Link href={`/cobrancas/${r.project_id}`}>` em vez de setar `?receivable=`.
- Abas com URL própria: mesmo mecanismo já usado no drawer antes de virar página (`?aba=detalhes|cobranca|acoes|historico`), com `TabsTrigger` renderizando `<Link>` (padrão idêntico ao já usado em Auditoria).
- Botão "Voltar": `router.back()` (histórico do navegador), preserva filtros/página/scroll da lista de Cobranças de onde o usuário veio.

**Tech Stack:** Next.js 15 App Router (rota dinâmica `src/app/(app)/cobrancas/[id]/page.tsx`), Server Component para busca de dados + Client Components para abas/dialogs (mesmo padrão das páginas existentes).

**Regra do projeto (sem exceção):** nenhuma mensagem de commit deve conter atribuição de IA. PR sempre para `develop`, nunca `main`. Títulos em CAIXA ALTA (já padronizado no sistema) valem também nesta página nova.

---

## Pré-requisitos confirmados (não repetir)

- `obterProjeto(id)` (`projectsService.ts:10-12`) já existe, consulta `v_projects_enriched`.
- `Receivable.project_id` já existe em todo recebível (`types/domain.ts:16`).
- `FormOperacional`, `FormValores` (dentro de `acoes-master.tsx`), `FormRecebimento`, `FormParcela` já existem e não precisam de nenhuma mudança interna — só de onde são chamados.
- Padrão de abas com URL (`TabsTrigger` + `render={<Link .../>}`) já usado em `auditoria/page.tsx` e no drawer atual (antes desta mudança) — mesmo mecanismo, sem inventar nada novo.
- `historicoRecebivel`/`listarAuditoria` já existem; a nova `historicoProjeto` segue o mesmo padrão de query direta em `audit_logs`.

---

## Task 1: Novas funções de serviço (projeto → recebíveis e histórico)

**Files:**
- Modify: `src/services/receivablesService.ts` (`listarRecebiveisPorProjeto`)
- Modify: `src/services/auditService.ts` (`historicoProjeto`)

- [ ] **Passo 1:** `listarRecebiveisPorProjeto(project_id: string): Promise<Receivable[]>` — `v_receivables_enriched`, `eq("project_id", project_id)`, `eq("active", true)`, `order("competence")`.
- [ ] **Passo 2:** `historicoProjeto(project_id: string, limite = 20): Promise<AuditLog[]>` — buscar ids de recebíveis do projeto (`select id from receivables where project_id = ...`), depois `audit_logs` com `or(entity_type.eq.projects,entity_id.eq.project_id)` combinado com recebíveis via `.in`. Mesma visibilidade master-only de `historicoRecebivel`.
- [ ] **Passo 3:** `npm run typecheck`

---

## Task 2: Rota `/cobrancas/[id]` (Server Component, busca dados)

**Files:**
- Create: `src/app/(app)/cobrancas/[id]/page.tsx`

- [ ] **Passo 1:** Server Component: `perfilAtual()`, `obterProjeto(id)` (404/redirect se não encontrado — usar `notFound()` do Next), `listarRecebiveisPorProjeto(id)`, `listarEtapas()`, `listarPerfis()`, e (se master) `historicoProjeto(id)`.
- [ ] **Passo 2:** `Topbar` com botão "Voltar" (client component pequeno usando `router.back()`) como `extra`.
- [ ] **Passo 3:** Renderiza o novo componente client `DetalheProjeto` (Task 3) passando os dados carregados.
- [ ] **Passo 4:** `npm run typecheck`

---

## Task 3: Componente `DetalheProjeto` com as 4 abas via URL

**Files:**
- Create: `src/components/cobrancas/detalhe-projeto.tsx`
- Delete: `src/components/cobrancas/drawer-cobranca.tsx` (substituído pela página)
- Modify: `src/components/cobrancas/lista-cobrancas.tsx` (remove uso do Drawer, `onAbrir` vira `<Link href={`/cobrancas/${r.project_id}`}>`)
- Modify: `src/components/cobrancas/tabela.tsx` (se `onAbrir` for chamado a partir daqui, trocar por `Link`)

- [ ] **Passo 1:** Estrutura de abas idêntica à já aprovada no drawer (`ABAS` com `master: boolean`, `TabsTrigger` + `Link` + `?aba=`), lendo `aba` via `useSearchParams()`.
- [ ] **Passo 2: Aba Detalhes** — bloco "Identificação" (dados do projeto, adaptado de `Project` em vez de `Receivable`) + bloco "Financeiro" como tabela por competência (reaproveitar o padrão de `Consolidado`/`TabelaGerencial`, mas escopado a este projeto).
- [ ] **Passo 3: Aba Cobrança** — tabela de recebíveis do projeto (Competência, Etapa, Responsável, Prazo, Saldo Projeto, Saldo Innovatis, Situação); cada linha com botão "Editar" abrindo `Dialog` com `FormOperacional`; botões por linha para "Editar valores" e "Registrar recebimento" (reaproveitando `FormValores`/`FormRecebimento` de dentro de `acoes-master.tsx` — extrair como componentes exportados se ainda não forem). Botão "Criar nova parcela" no topo da aba (reaproveita `FormParcela`).
- [ ] **Passo 4: Aba Ações** (só master) — Editar cadastro, Alterar Fase, Alterar Situação, Excluir da gestão/Restaurar — adaptados para operar em `project_id` direto (sem depender de um `Receivable` específico).
- [ ] **Passo 5: Aba Histórico** (só master) — tabela de `historicoProjeto`, mesmo componente visual de `Historico`, mas título/fonte de dados ajustados (todas as competências, não só uma).
- [ ] **Passo 6:** `npm run typecheck` / `npm run lint`
- [ ] **Passo 7:** Teste visual completo: abrir projeto pela lista de Cobranças, navegar pelas 4 abas (URL muda), editar um recebível específico, voltar com o botão Voltar preservando filtros.
- [ ] **Passo 8:** Commit

---

## Depois de todas as tasks

- [ ] `npm run lint` / `npm run typecheck` / `npm run test` / `npm run build` limpos
- [ ] Push da branch (`feature/pagina-detalhe-projeto`, a partir de `develop`) e abertura de PR contra `develop`
