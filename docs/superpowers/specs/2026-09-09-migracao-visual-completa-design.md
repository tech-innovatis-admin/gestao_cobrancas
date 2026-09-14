# Migração visual completa (Cobranças, Visão Geral, Auditoria, Layout) — Design

## Contexto

O sub-projeto anterior (`docs/superpowers/specs/2026-09-08-shadcn-ui-foundation-design.md`) instalou a fundação do shadcn/ui e migrou só a tela de Login/Alterar Senha, deixando Cobranças, Visão Geral, Auditoria e o Layout (Sidebar/Topbar) explicitamente fora de escopo, como sub-projetos futuros.

Decisão do usuário nesta sessão: em vez de tratar cada tela como um sub-projeto isolado e independente no tempo, fazer a migração completa das telas restantes agora, no mesmo branch (`worktree-shadcn-ui-foundation`), abrindo um único PR só quando tudo estiver com visual novo e `lint`/`typecheck`/`test`/`build` verdes.

Motivo: hoje o `npm run build` falha (erros de tipo nos usos antigos de `Badge`/`Button`/`Tabs`) — mergear a fundação isolada deixaria `develop` com o build quebrado até o próximo sub-projeto. O CI (`.github/workflows/ci.yml`) só roda em PR/push pra `main`, então isso não quebraria pipeline nenhum, mas o usuário preferiu concluir tudo antes de abrir o PR.

## Escopo e decomposição em sub-projetos

O volume de código é grande (19 arquivos em 4 áreas, incluindo um painel com ~35 campos de formulário sem nenhuma validação client-side hoje). Em vez de um plano único, cada sub-projeto abaixo ganha seu próprio plano de implementação (`writing-plans`), executado via `subagent-driven-development` (implementador → revisor de spec → revisor de qualidade por task), na ordem:

1. **Layout** (`src/components/layout/sidebar.tsx`, `topbar.tsx`) — re-skin visual, pequeno.
2. **Auditoria** (`src/app/(app)/auditoria/page.tsx` + `src/components/auditoria/{alteracoes,qualidade,sincronizacoes,usuarios}.tsx`) — badges, botões, tabela, tabs.
3. **Visão Geral** (`src/components/visao-geral/{cards,filtros-globais,graficos,tabelas-gerenciais,consolidado}.tsx`).
4. **Cobranças — Filtros e Tabela** (`src/components/cobrancas/{filtros-cobrancas,filtros-rapidos,tabela,lista-cobrancas,paginacao,historico}.tsx`, `src/components/filtros/campos.tsx`).
5. **Cobranças — Ações do Master Admin** (`src/components/cobrancas/acoes-master.tsx`: 7 modais, ~35 campos — o mais arriscado, fica pro final, depois de já termos praticado o padrão nas partes menores).

Cada sub-projeto só começa depois do anterior estar com `typecheck` limpo nos arquivos que ele tocou (não precisa esperar o `build` global ficar verde entre um e outro — só o Master Admin, por último, deixa tudo verde de vez).

## Decisões técnicas transversais

Valem para todos os sub-projetos acima; documentadas aqui uma vez em vez de repetir em cada plano.

### Badge (`tom` → `variant`)

Mapeamento de cor, aplicado em todo lugar que hoje usa `<Badge tom="...">` (`badges-dominio.tsx`, `topbar.tsx`, `qualidade.tsx`, `sincronizacoes.tsx`, `usuarios.tsx`):

| `tom` antigo | `variant` novo |
|---|---|
| `green` | `ok` |
| `red` | `danger` |
| `orange` | `warn` |
| `blue` | `info` |
| `neutral` | `secondary` |

`badges-dominio.tsx` é o ponto central (`BadgeFin`, `BadgeSituacao`, `BadgeSync`, `BadgeFase`, `BadgeProvisorio`, `BadgeConsolidado`) — migrar esse arquivo primeiro resolve a maior parte dos usos indiretos; `topbar.tsx`, `qualidade.tsx`, `sincronizacoes.tsx`, `usuarios.tsx` usam `Badge` direto e precisam do ajuste próprio.

### Button (`variant`)

| `variant` antigo | `variant` novo |
|---|---|
| `"primary"` | `"default"` |
| `"danger"` | `"destructive"` |

Usos existentes de `"outline"`/`"ghost"` já batem com o shadcn, sem mudança.

### Select nativo → `Select` do shadcn

Troca `<select className="field">` por `Select`/`SelectTrigger`/`SelectContent`/`SelectItem` (instalado na Task 2 da fundação). Mudança de API: `onChange={(e) => set(e.target.value)}` vira `onValueChange={set}` — o Base UI Select não é um `<select>` nativo, não dispara evento de change. Afeta `src/components/filtros/campos.tsx` (`SelectFiltro`, usado por Cobranças e Visão Geral) e os `<select>` inline dentro dos modais de `acoes-master.tsx`.

### Tabelas → `Table` do shadcn

Substitui a classe customizada `.tbl` pelos componentes `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` (instalados na Task 2). Aplica-se a `tabela.tsx` (Cobranças), `tabelas-gerenciais.tsx` (Visão Geral), e às tabelas dentro de `alteracoes.tsx`/`usuarios.tsx`/`sincronizacoes.tsx` (Auditoria).

### Formulários → react-hook-form + zod

Mesmo padrão do Login/Alterar Senha (`Field`/`FieldLabel`/`FieldError`/`Controller`, ver `docs/superpowers/specs/2026-09-08-shadcn-ui-foundation-design.md` e as Tasks 5-7 do plano da fundação).

Achado importante: `src/services/receivablesActions.ts` **já tem schemas zod inline** (`operacional`, `recibo`, `financeiro`, `novoRecebivel`, `projeto`) — mesma situação que `authActions.ts` tinha antes da Task 5 da fundação. Cada schema precisa ser extraído pra um módulo compartilhado (padrão: `src/lib/schemas/receivables.ts`) e usado tanto pela Server Action quanto pelo `zodResolver` no cliente.

Dois formulários precisam de atenção extra (não são wiring mecânico de `Controller`):
- **`FormRecebimento`**: o checkbox "confirmo que o valor está correto" só é obrigatório quando o valor recebido supera o previsto — validação condicional entre campos (`.superRefine()` no zod, não uma regra de campo único).
- **`FormValores`/`FormRecebimento`**: campos de moeda em formato brasileiro (`1.234,56`), com conversão via `parseBRL`/`fmtBRL` já existentes em `src/lib/format.ts` — o schema precisa validar a string formatada (ou um `z.preprocess`/transform que aplica `parseBRL` antes de validar o número), não `z.number()` direto sobre o valor do campo.

Formulários mais simples (`FormFase`, `FormSituacao`, `FormCadastro`, `FormParcela`, `FormMotivo`, `novo-projeto.tsx`) seguem o wiring direto igual Login/Alterar Senha.

### Tabs (Auditoria)

`src/app/(app)/auditoria/page.tsx` usa hoje um `Tabs` customizado (`itens`/`atual`/`base`) que renderiza links reais de navegação — a aba ativa vem de `searchParams`, e o conteúdo de cada aba é renderizado no servidor. O `Tabs`/`TabsTrigger` do shadcn (Base UI) é um primitivo de estado client-side, não pensado pra navegação por URL — mas o componente `Tab` aceita uma prop `render` (renderização polimórfica, confirmado lendo `node_modules/@base-ui/react/tabs/tab/TabsTab.d.mts` e `internals/types.d.mts`), então:

```tsx
<Tabs value={tab}>
  <TabsList>
    <TabsTrigger value="alteracoes" render={<Link href="?tab=alteracoes" />}>Alterações</TabsTrigger>
    {/* ... */}
  </TabsList>
</Tabs>
```

Isso preserva URL compartilhável e conteúdo renderizado no servidor via `searchParams`, só trocando a casca visual pela do shadcn — usa um mecanismo que a própria biblioteca oferece pra esse caso, não uma adaptação forçada.

## Layout (Sidebar/Topbar)

O shadcn tem um componente `Sidebar` completo (colapsável, atalho de teclado, Provider próprio, drawer no mobile) — **decisão: não instalar esse componente**. O `Sidebar` atual do projeto é simples (3 itens de navegação, largura fixa, sempre visível) e é uma ferramenta interna V0; a complexidade extra do componente completo do shadcn não se paga aqui (YAGNI).

Em vez disso: re-skin da estrutura atual (mesmo HTML/lógica, mesmo `Link`+`usePathname` pra estado ativo), trocando os tokens de cor "navy institucional" pelos tokens neutros do shadcn:

| Antigo | Novo |
|---|---|
| `bg-navy` | `bg-sidebar` (ou `bg-background`, a definir no plano conforme o que ficar visualmente melhor) |
| `text-white` / `text-white/70` | `text-sidebar-foreground` / `text-muted-foreground` |
| `bg-white/10` (item ativo) | `bg-accent` / `bg-muted` |

Itens de navegação usam a classe visual do `Button` (`variant="ghost"`) como base, mantendo o `Link` real por baixo (mesmo raciocínio de polimorfismo das Tabs).

`Topbar`: troca `bg-white`/`text-navy`/`border-line`/`text-ink-faint` pelos tokens `bg-background`/`text-foreground`/`border-border`/`text-muted-foreground`. O `Badge` de status de sincronização segue o mapeamento de cor já definido acima.

## Testes/validação

Mesmo padrão da fundação: sem framework de teste novo (`vitest` continua só pra funções puras). Cada sub-projeto valida com `npm run lint`/`typecheck`/`test`/`build` (escopados aos arquivos que ele tocou — os demais sub-projetos ainda não migrados continuam gerando os erros já conhecidos, até que a lista chegue a zero no último) e teste manual no navegador.

## Critério de conclusão

Depois do sub-projeto 5 (Ações do Master Admin), `npm run lint`/`typecheck`/`test`/`build` devem passar sem nenhum erro (não só "sem erros novos" — os 21 erros pré-existentes, nos 7 arquivos listados na fundação, precisam ter zerado). Só então abre o PR único contra `develop`.
