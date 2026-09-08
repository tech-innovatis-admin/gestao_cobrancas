# Fundação shadcn/ui + migração da tela de Login — Design

## Contexto

O projeto (INNOVATIS | Gestão de Cobranças) usa hoje um sistema de UI próprio, feito à mão em Tailwind (`src/components/ui/*.tsx`: `button.tsx`, `badge.tsx`, `tabs.tsx`, `modal.tsx`, `drawer.tsx`, `basicos.tsx`), com classes utilitárias (`.panel`, `.field`, `.badge`, `.tbl`) definidas em `globals.css`, num visual denso e corporativo ("navy institucional"). O pedido é substituir isso pelo shadcn/ui em todos os componentes, seletores, inputs e formulários do app.

Dado o tamanho do escopo (o app inteiro), este documento cobre só o **primeiro sub-projeto**: a fundação do shadcn (instalação, configuração, componentes base) mais a migração da tela de **Login/Autenticação** como prova de conceito. As demais áreas (Cobranças, Visão Geral, Auditoria) são sub-projetos futuros, cada um com seu próprio design/plano quando chegar a vez.

**Atualização pós-tentativa de implementação:** a primeira tentativa de rodar a Task 1 (init do shadcn) revelou que a versão atual da CLI do shadcn (`v4.21`) gera tema no formato Tailwind v4 (CSS-first, `@theme` em `globals.css`), incompatível com o Tailwind v3.4 deste projeto — quebra o build (`bg-background` classe não existe). Decisão do usuário: **atualizar o projeto pra Tailwind v4** em vez de forçar uma versão antiga da CLI ou uma configuração híbrida manual, pra ficar no caminho "padrão" de verdade da ferramenta. Isso adiciona uma task de upgrade do Tailwind antes da instalação do shadcn (ver plano).

Segunda decisão relacionada: a CLI hoje usa **Base UI** como biblioteca de primitivos por padrão (em vez de Radix UI, que era o padrão até pouco tempo atrás e o que este documento assumia originalmente). Base UI e a versão do Tailwind são eixos independentes — daria pra combinar Tailwind v4 com Radix (`-b radix`) — mas a decisão foi ficar com **Base UI**, por ser o padrão atual da ferramenta e a direção que ela está tomando.

## Decisões

### 1. Visual: shadcn padrão, sem re-temar

Comparação visual feita durante o brainstorming (barra de filtros real de Cobranças, 12 campos) entre (A) visual padrão do shadcn e (B) shadcn re-temado pra manter a densidade/cores atuais. **Decisão: A — visual padrão do shadcn**, aceitando que o app fica mais espaçoso e menos denso do que é hoje. Base color: `Neutral` (padrão do `shadcn init` quando nenhuma preferência é informada, e o mais comum em produtos profissionais).

**Exceção deliberada — Badge:** o shadcn padrão só tem 4 variantes (`default`/`secondary`/`destructive`/`outline`), nenhuma mapeando pra "verde = pago", "laranja = alerta" etc., que hoje carregam significado de negócio (situação financeira, alertas de qualidade). Decisão: manter esse código de cores, adicionando variantes `ok`/`danger`/`warn`/`info` ao componente `Badge` gerado pelo shadcn, usando o mesmo mecanismo CVA que ele já usa internamente — não é um componente paralelo, é o componente shadcn com mais opções.

### 2. Formulários: react-hook-form + zod (não só troca visual)

Avaliadas duas abordagens: (A) só trocar `<input>`/`<select>` brutos pelos componentes shadcn, mantendo a lógica atual em `useState`; (B) adotar react-hook-form + zod, o padrão nativo do shadcn `Form`. **Decisão: B**, pelos motivos (não é sobre velocidade — B é mais lento de implementar):

- Elimina duplicação de validação: os schemas zod que já existem nos Server Actions (`src/services/*Actions.ts`) passam a ser compartilhados entre cliente (via `zodResolver`) e servidor — hoje a validação client-side é praticamente inexistente.
- Acessibilidade correta de fábrica: `Form`/`FormField`/`FormMessage` do shadcn conectam `aria-describedby`/`aria-invalid`/`label htmlFor` automaticamente.
- Melhor performance em formulários grandes (inputs não-controlados por baixo do react-hook-form).

**Custo aceito:** `src/components/cobrancas/form-operacional.tsx` (fora do escopo deste sub-projeto, mas a decisão vale pra quando chegar lá) tem lógica própria de diff antes/depois e resolução de conflito otimista sobre um `useState` manual — será reescrita para ler de `formState.dirtyFields`/`getValues()` do react-hook-form. A lógica de negócio (comparar versões, mostrar conflito) não muda, só a fonte dos dados do formulário.

### 3. Arquitetura: substituição in-place

O CLI do shadcn gera código diretamente em `src/components/ui/*.tsx` — a mesma pasta que os componentes atuais já ocupam. A migração troca o **conteúdo** desses arquivos pelos equivalentes do shadcn, sem mudar como o resto do app importa (`@/components/ui/button` etc.) nem a estrutura de pastas.

O projeto já tem `class-variance-authority`, `clsx`, `tailwind-merge` e `lucide-react` como dependências — exatamente o que o shadcn usa por baixo. A regra do `CLAUDE.md` de que componentes nunca chamam `supabase-js` direto não muda: shadcn só troca a camada visual, Server Actions continuam mediando toda mutação.

### 4. Componentes e dependências novas (fundação)

Instalados via CLI do shadcn (cada um vira um arquivo em `src/components/ui/`):
`button`, `input`, `select`, `textarea`, `label`, `badge` (com variantes extra — ver decisão 1), `dialog` (substitui `modal.tsx`), `sheet` (substitui `drawer.tsx`), `tabs`, `table`, `skeleton`, `alert` (substitui o `<Erro/>` atual em `basicos.tsx`, mesma API — prop `msg` opcional), `form` (integração com react-hook-form).

Novas dependências: `@base-ui-components/react` (primitivos acessíveis por trás de cada componente — ver atualização no topo do documento), `react-hook-form`, `@hookform/resolvers`, `tailwindcss@4`/`@tailwindcss/postcss` (upgrade do Tailwind, pré-requisito).

### 5. Escopo deste sub-projeto

- Fundação: `npx shadcn init`, configurar `components.json` e Tailwind, gerar os componentes listados acima.
- Migrar `src/app/(auth)/login/login-form.tsx` e a página de alterar senha (`src/app/(auth)/alterar-senha/`) pra usar os novos componentes + react-hook-form + zod — telas pequenas, poucos campos, valida o pipeline inteiro antes de ir pra área grande (Cobranças).

Fora de escopo (sub-projetos futuros): Cobranças, Visão Geral, Auditoria, layout (`sidebar`/`topbar`).

### 6. Testes

Não existe suite de teste de componente hoje (só `format.test.ts` pra funções puras) — não introduz framework novo agora. Validação: `npm run typecheck`, `npm run build`, teste manual no navegador.

### 7. Branch

Trabalho isolado num worktree próprio (`worktree-shadcn-ui-foundation`), branch a partir da `develop` — separado da branch da FASE 3 (sincronização Google Sheets) que está em andamento em paralelo.
