# Fundação shadcn/ui + Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instalar o shadcn/ui neste projeto (visual padrão, sem re-temar), com uma variante de Badge que preserva o código de cores de negócio, e migrar a tela de Login + Alterar Senha para os novos componentes com react-hook-form + zod (schemas compartilhados com os Server Actions).

**Architecture:** O CLI do shadcn gera componentes direto em `src/components/ui/*.tsx` — a mesma pasta que os componentes atuais já ocupam. Nada na estrutura de imports do resto do app muda (`@/components/ui/button` etc. continuam existindo, só o conteúdo interno muda). Ver design completo em `docs/superpowers/specs/2026-09-08-shadcn-ui-foundation-design.md`.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind CSS 3.4, shadcn/ui (CLI v4, base Radix), react-hook-form, @hookform/resolvers/zod, zod (já presente).

---

## Pré-requisitos confirmados nesta sessão

- `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` já são dependências do projeto — compatíveis com o que o shadcn usa por baixo.
- CLI do shadcn instalado é a v4.21 (`npx shadcn@latest`) — usa `--defaults`/`--preset` em vez do antigo `--base-color`. Comando de init verificado: `npx shadcn@latest init --yes --defaults`.
- `loginAction`/`alterarSenhaAction` (`src/services/authActions.ts`) seguem a convenção `(prevState, FormData) => FormState`, feitas pra `useActionState` + `<form action={...}>`. Para integrar com react-hook-form mantendo essa mesma função de servidor sem reescrevê-la, o padrão adotado é: manter `useActionState` (pra pending/erro), mas trocar o `<form action={formAction}>` por `<form onSubmit={form.handleSubmit(onValid)}>`, onde `onValid` monta um `FormData` a partir dos dados validados pelo react-hook-form e chama `formAction(fd)` programaticamente. Isso sacrifica o fallback sem-JS (aceitável — é uma ferramenta interna atrás de login, não uma página pública), mas mantém a Server Action e o estado de erro exatamente como estão.

---

## Task 1: Inicializar shadcn/ui e instalar componentes base

**Files:**
- Create: `components.json` (gerado pelo CLI)
- Modify: `tailwind.config.ts`, `src/app/globals.css`, `package.json` (gerado/modificado pelo CLI)
- Create: `src/lib/utils.ts` (gerado pelo CLI — **verificar se já existe** antes, ver Passo 1)
- Create: `src/components/ui/{button,input,select,textarea,label,badge,dialog,sheet,tabs,table,skeleton,alert,form}.tsx` (gerados pelo CLI)

O projeto já tem `src/lib/utils.ts` (com a função `cn`, usada em `basicos.tsx`) e já tem `button.tsx`/`badge.tsx`/`tabs.tsx`/`modal.tsx`/`drawer.tsx` em `src/components/ui/`. O CLI do shadcn vai tentar sobrescrever esses arquivos — isso é esperado e é o objetivo desta task (Passo 1 confirma antes de deixar sobrescrever).

- [ ] **Passo 1: Checar o que já existe antes de rodar o CLI**

```bash
cat src/lib/utils.ts
ls src/components/ui/
```

Se `src/lib/utils.ts` já exportar uma função `cn` baseada em `clsx`+`tailwind-merge` (é o que se espera, já que o projeto já usa essas libs), o CLI deve reconhecer e não duplicar — mas confirme lendo o arquivo antes de continuar, pra não haver surpresa.

- [ ] **Passo 2: Rodar o init do shadcn**

```bash
npx shadcn@latest init --yes --defaults
```

Isso deve: criar/atualizar `components.json`, ajustar `tailwind.config.ts` (adiciona tokens de cor via CSS variables, `tailwindcss-animate` ou `tw-animate-css` no plugins), e adicionar variáveis de tema (`:root { --background: ...; --foreground: ...; }` etc.) em `src/app/globals.css`.

**Atenção:** o `globals.css` atual já tem `@layer base`/`@layer components` com classes customizadas (`.panel`, `.field`, `.badge`, `.tbl` etc., usadas pelo resto do app que ainda não foi migrado). O CLI **não deve remover** esse conteúdo (ele só adiciona as variáveis de tema shadcn no topo/`:root`) — confirme após rodar que essas classes continuam lá intactas:

```bash
grep -c "\.panel\|\.field\|\.tbl" src/app/globals.css
```

Se o número for menor que antes do comando (era 1 ocorrência de `.panel` na definição + várias referências), **pare e reporte** — não prossiga sobrescrevendo manualmente, isso indica que o CLI removeu conteúdo que não deveria.

- [ ] **Passo 3: Instalar os componentes base**

```bash
npx shadcn@latest add button input select textarea label badge dialog sheet tabs table skeleton alert form --yes --overwrite
```

`--overwrite` é necessário pois `button.tsx`, `badge.tsx`, `tabs.tsx` já existem (versões customizadas atuais) — a sobrescrita é o objetivo. Isso também instala `react-hook-form`, `@hookform/resolvers`, e os pacotes `@radix-ui/react-*` necessários automaticamente (o componente `form` puxa `react-hook-form`+`@hookform/resolvers` como dependência).

- [ ] **Passo 4: Verificar que nada quebrou no resto do app** (que ainda usa os componentes antigos `modal.tsx`/`drawer.tsx`, não tocados nesta task, e as classes `.panel`/`.field`/`.tbl` do CSS)

```bash
npm run typecheck
npm run build
```

Isso vai gerar erros de tipo nos lugares que usavam a API antiga de `Button`/`Badge`/`Tabs` (props diferentes) — **isso é esperado nesta task**, já que só `login-form.tsx`/`alterar-senha` serão migrados agora; o resto do app ainda não foi. Se os erros forem exclusivamente sobre uso de `Button`/`Badge`/`Tabs` fora de `login-form.tsx`/`alterar-senha`/`page.tsx` de login, **isso é aceitável para esta task** — registre a lista de arquivos afetados no relatório final (serão corrigidos nas próximas tasks/sub-projetos, quando cada área migrar). Se houver erro em `src/lib/utils.ts` ou em `globals.css` não compilando, isso SIM precisa ser corrigido agora.

- [ ] **Passo 5: Commit**

```bash
git add components.json tailwind.config.ts src/app/globals.css src/lib/utils.ts src/components/ui/ package.json package-lock.json
git commit -m "feat: inicializa shadcn/ui e instala componentes base"
```

Não commitar ainda as mudanças em arquivos que dependem dos componentes antigos (esses serão corrigidos task por task, sub-projeto por sub-projeto) — se `git status` mostrar modificações inesperadas em outros arquivos além dos listados acima, pare e reporte antes de commitar.

---

## Task 2: Badge com variantes de negócio (ok/danger/warn/info)

**Files:**
- Modify: `src/components/ui/badge.tsx` (gerado na Task 1 — adicionar variantes)

**Contexto:** o `badge.tsx` gerado pelo shadcn usa CVA com variantes `default`/`secondary`/`destructive`/`outline`. Hoje o app tem badges coloridas com significado de negócio (`b-green`=pago/ok, `b-red`=alerta/perigo, `b-orange`=aviso, `b-blue`=info) definidas em `globals.css` e usadas via `<Badge tom="green">` (ver `src/components/ui/badges-dominio.tsx` e chamadas em `sincronizacoes.tsx` como `<Badge tom={r.status === "success" ? "green" : ...}>`). Adicionar variantes equivalentes ao componente shadcn preservando esse uso.

- [ ] **Passo 1: Ler o badge.tsx gerado pela Task 1 pra saber a estrutura exata do CVA**

```bash
cat src/components/ui/badge.tsx
```

- [ ] **Passo 2: Adicionar 4 variantes ao `badgeVariants` (CVA) do arquivo gerado** — mantendo tudo que o CLI gerou, só estendendo o objeto `variants.variant` com:

```typescript
ok: "border-transparent bg-emerald-100 text-emerald-800 [a&]:hover:bg-emerald-100/90 dark:bg-emerald-950 dark:text-emerald-300",
danger: "border-transparent bg-red-100 text-red-800 [a&]:hover:bg-red-100/90 dark:bg-red-950 dark:text-red-300",
warn: "border-transparent bg-amber-100 text-amber-800 [a&]:hover:bg-amber-100/90 dark:bg-amber-950 dark:text-amber-300",
info: "border-transparent bg-blue-100 text-blue-800 [a&]:hover:bg-blue-100/90 dark:bg-blue-950 dark:text-blue-300",
```

(Ajuste as classes exatas pro padrão que o CLI realmente gerou nas variantes existentes — copie o formato/convenção de `destructive` como referência, o texto acima é o INTENTO de cor, não copie literalmente se a sintaxe gerada for diferente.)

- [ ] **Passo 3: Verificar tipagem**

```bash
npm run typecheck
```

O tipo de `variant` do `Badge` (inferido via `VariantProps<typeof badgeVariants>`) deve agora aceitar `"ok" | "danger" | "warn" | "info"` além dos 4 originais — confirme que não há erro.

- [ ] **Passo 4: Teste manual rápido** — criar um `.tsx` de teste temporário (não commitado) ou usar o Storybook/página existente pra renderizar `<Badge variant="ok">Pago</Badge>`, `<Badge variant="danger">Alerta</Badge>` etc. e confirmar visualmente que as cores aparecem corretas. Se não houver uma página fácil pra isso, pode pular e confirmar só via typecheck + leitura do código — não é obrigatório rodar visualmente nesta task específica, já que o uso real só acontece quando `sincronizacoes.tsx` e outros forem migrados num sub-projeto futuro.

- [ ] **Passo 5: Commit**

```bash
git add src/components/ui/badge.tsx
git commit -m "feat: adiciona variantes ok/danger/warn/info ao Badge do shadcn"
```

---

## Task 3: Migrar `Erro` (basicos.tsx) para usar Alert do shadcn

**Files:**
- Modify: `src/components/ui/basicos.tsx`

**Contexto:** `Erro` é usado em vários lugares do app com a API `<Erro msg={string | null | undefined} />`. Manter essa mesma assinatura, só trocar a implementação interna pra usar `Alert`/`AlertDescription` do shadcn (instalado na Task 1).

- [ ] **Passo 1: Ler o alert.tsx gerado pela Task 1**

```bash
cat src/components/ui/alert.tsx
```

- [ ] **Passo 2: Reescrever `Erro` em `src/components/ui/basicos.tsx`** mantendo `Skeleton`, `EmptyState`, `Pendente` como estão (não fazem parte desta task), só trocando a implementação de `Erro`:

```typescript
import { Alert, AlertDescription } from "@/components/ui/alert";
// ... (demais imports/exports existentes de basicos.tsx continuam)
export const Erro = ({ msg }: { msg?: string | null }) =>
  msg ? <Alert variant="destructive"><AlertDescription>{msg}</AlertDescription></Alert> : null;
```

(Ajuste os imports exatos de `Alert`/`AlertDescription` conforme o que o arquivo gerado realmente exporta — confirme os nomes exportados no Passo 1 antes de escrever este import.)

- [ ] **Passo 3: Verificar que nenhum call-site quebrou** — `Erro` é usado em `login-form.tsx`, `alterar-senha/page.tsx`, `form-operacional.tsx` e possivelmente outros. A assinatura (`msg` como única prop) não muda, então nenhum call-site deveria precisar de alteração.

```bash
grep -rn "<Erro " src/ --include="*.tsx"
npm run typecheck
```

- [ ] **Passo 4: Commit**

```bash
git add src/components/ui/basicos.tsx
git commit -m "feat: migra Erro para usar Alert do shadcn, mantendo a mesma API"
```

---

## Task 4: Extrair schema zod compartilhado de autenticação

**Files:**
- Create: `src/lib/schemas/auth.ts`
- Modify: `src/services/authActions.ts` (usar o schema extraído em vez do inline)

Antes de migrar os formulários, extrai os schemas zod hoje inline em `authActions.ts` pra um módulo compartilhável entre cliente e servidor.

- [ ] **Passo 1: Criar `src/lib/schemas/auth.ts`**

```typescript
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  senha: z.string().min(1, "Informe a senha."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const alterarSenhaSchema = z
  .object({
    senha: z.string().min(8, "Mínimo de 8 caracteres."),
    confirmar: z.string(),
  })
  .refine((d) => d.senha === d.confirmar, { message: "As senhas não conferem.", path: ["confirmar"] });
export type AlterarSenhaInput = z.infer<typeof alterarSenhaSchema>;
```

Note: `path: ["confirmar"]` é uma adição em relação ao schema inline atual (que não tinha `path` no `.refine`) — isso permite que o react-hook-form associe o erro de "senhas não conferem" especificamente ao campo de confirmação, em vez de um erro genérico do formulário. É uma melhoria pequena e segura, mantendo a mesma regra de negócio.

- [ ] **Passo 2: Atualizar `src/services/authActions.ts`** pra usar os schemas extraídos em vez de definir inline. Modifique só as duas linhas de parse, mantendo todo o resto do arquivo (incluindo `next` como campo separado do `loginSchema`, já que `next` não é validado como parte do login em si — continue extraindo `next` do FormData separadamente como já é feito, só troque a validação de `email`/`senha`):

```typescript
import { loginSchema, alterarSenhaSchema } from "@/lib/schemas/auth";
// ...
export async function loginAction(_p: FormState, fd: FormData): Promise<FormState> {
  const next = String(fd.get("next") ?? "/visao-geral");
  const s = loginSchema.safeParse({ email: fd.get("email"), senha: fd.get("senha") });
  if (!s.success) return { erro: "Informe e-mail e senha." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: s.data.email.trim().toLowerCase(), password: s.data.senha });
  if (error) return { erro: "E-mail ou senha inválidos." };
  const { data: prof } = await supabase.from("profiles").select("active, must_change_password").eq("email", s.data.email.trim().toLowerCase()).maybeSingle();
  if (!prof?.active) { await supabase.auth.signOut(); return { erro: "Usuário inativo. Procure o Master Admin." }; }
  await supabase.rpc("rpc_touch_last_login");
  redirect(prof.must_change_password ? "/alterar-senha" : (next.startsWith("/") ? next : "/visao-geral"));
}
```

```typescript
export async function alterarSenhaAction(_p: FormState, fd: FormData): Promise<FormState> {
  const s = alterarSenhaSchema.safeParse({ senha: fd.get("senha"), confirmar: fd.get("confirmar") });
  if (!s.success) return { erro: s.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: s.data.senha });
  if (error) return { erro: error.message };
  await supabase.rpc("rpc_password_changed");
  redirect("/visao-geral");
}
```

- [ ] **Passo 3: Verificar**

```bash
npm run typecheck
npm run test
```

Nenhum teste existente cobre `authActions.ts` diretamente (confirme com `grep -rn "authActions" src/**/*.test.ts` — se não houver nenhum, é esperado, não precisa criar teste novo aqui, mantém o padrão do projeto).

- [ ] **Passo 4: Commit**

```bash
git add src/lib/schemas/auth.ts src/services/authActions.ts
git commit -m "refactor: extrai schemas zod de autenticacao para modulo compartilhavel"
```

---

## Task 5: Migrar `LoginForm` para shadcn + react-hook-form

**Files:**
- Modify: `src/app/(auth)/login/login-form.tsx`

- [ ] **Passo 1: Reescrever com os componentes shadcn instalados na Task 1 e o schema da Task 4**

```typescript
"use client";
import { useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginAction, type FormState } from "@/services/authActions";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Erro } from "@/components/ui/basicos";

export const LoginForm = ({ next, aviso }: { next: string; aviso?: string }) => {
  const [state, formAction, pending] = useActionState<FormState, FormData>(loginAction, {});
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", senha: "" } });

  const onValid = (data: LoginInput) => {
    const fd = new FormData();
    fd.set("email", data.email);
    fd.set("senha", data.senha);
    fd.set("next", next);
    formAction(fd);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onValid)} className="w-full max-w-sm space-y-4 rounded-lg border p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold">Entrar</h2>
          <p className="text-sm text-muted-foreground">Use seu e-mail corporativo.</p>
        </div>
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel>E-mail</FormLabel>
            <FormControl><Input type="email" autoComplete="email" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="senha" render={({ field }) => (
          <FormItem>
            <FormLabel>Senha</FormLabel>
            <FormControl><Input type="password" autoComplete="current-password" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Erro msg={state.erro ?? aviso} />
        <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</Button>
      </form>
    </Form>
  );
};
```

Note: a classe `panel` (customizada, do CSS antigo) foi trocada por `rounded-lg border p-6 shadow-sm` (utilitários Tailwind puros, no espírito do visual padrão shadcn) — isso é intencional, parte da decisão de design de não re-temar. Se ficar visualmente estranho ao lado do painel navy da página de login (`page.tsx` mantém `bg-navy` no lado esquerdo), ajuste as classes livremente, o importante é não reintroduzir a classe `.panel` antiga aqui.

- [ ] **Passo 2: Rodar o app e testar manualmente no navegador**

```bash
npm run dev
```

Acesse `/login` (local Supabase já deve estar rodando — mesma instância usada no resto desta sessão, usuário de teste `admin@teste.local`/`Teste@123`). Confirme:
- Campos vazios ao submeter mostram erro de validação do react-hook-form (client-side, instantâneo, sem round-trip ao servidor) — ex: "Informe um e-mail válido."
- Email/senha corretos → loga e redireciona.
- Email/senha incorretos → mostra o erro vindo da Server Action (`state.erro`, "E-mail ou senha inválidos.") através do componente `Erro`/`Alert`.

- [ ] **Passo 3: Commit**

```bash
git add src/app/\(auth\)/login/login-form.tsx
git commit -m "feat: migra LoginForm para shadcn/ui + react-hook-form"
```

---

## Task 6: Migrar `AlterarSenhaPage` para shadcn + react-hook-form

**Files:**
- Modify: `src/app/(auth)/alterar-senha/page.tsx`

- [ ] **Passo 1: Reescrever seguindo o mesmo padrão da Task 5**

```typescript
"use client";
import { useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { alterarSenhaAction, type FormState } from "@/services/authActions";
import { alterarSenhaSchema, type AlterarSenhaInput } from "@/lib/schemas/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Erro } from "@/components/ui/basicos";

export default function AlterarSenhaPage() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(alterarSenhaAction, {});
  const form = useForm<AlterarSenhaInput>({ resolver: zodResolver(alterarSenhaSchema), defaultValues: { senha: "", confirmar: "" } });

  const onValid = (data: AlterarSenhaInput) => {
    const fd = new FormData();
    fd.set("senha", data.senha);
    fd.set("confirmar", data.confirmar);
    formAction(fd);
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onValid)} className="w-full max-w-sm space-y-4 rounded-lg border p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">Defina sua nova senha</h2>
            <p className="text-sm text-muted-foreground">Por segurança, a senha temporária precisa ser substituída no primeiro acesso.</p>
          </div>
          <FormField control={form.control} name="senha" render={({ field }) => (
            <FormItem>
              <FormLabel>Nova senha</FormLabel>
              <FormControl><Input type="password" autoComplete="new-password" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="confirmar" render={({ field }) => (
            <FormItem>
              <FormLabel>Confirmar</FormLabel>
              <FormControl><Input type="password" autoComplete="new-password" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <Erro msg={state.erro} />
          <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Salvando…" : "Salvar e continuar"}</Button>
        </form>
      </Form>
    </main>
  );
}
```

- [ ] **Passo 2: Testar manualmente** — logar com `admin@teste.local`, forçar `must_change_password=true` no profile via SQL se necessário pra acessar a tela (`update profiles set must_change_password=true where email='admin@teste.local'`), confirmar: senha curta (<8 chars) mostra erro client-side instantâneo; senhas diferentes mostram erro no campo "Confirmar"; senha válida salva e redireciona pra `/visao-geral`. Depois de testar, reverta `must_change_password` pra `false` se quiser manter o usuário de teste como estava.

- [ ] **Passo 3: Commit**

```bash
git add src/app/\(auth\)/alterar-senha/page.tsx
git commit -m "feat: migra AlterarSenhaPage para shadcn/ui + react-hook-form"
```

---

## Task 7: Verificação final e handoff

**Files:** nenhum (task de verificação)

- [ ] **Passo 1: Rodar a suite completa**

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

`typecheck`/`build` provavelmente ainda mostram erros em arquivos FORA do escopo desta task (que usam a API antiga de `Button`/`Badge`/`Tabs` — `sidebar.tsx`, `topbar.tsx`, componentes de `cobrancas/`, `visao-geral/`, `auditoria/`) — isso é esperado e aceitável (ver Task 1, Passo 4). Liste esses arquivos no relatório final pra ficarem documentados como pendências dos próximos sub-projetos.

- [ ] **Passo 2: Teste manual final** — fluxo completo login → (troca de senha, se aplicável) → visão geral, confirmando visualmente que a tela de login está com o visual novo (shadcn padrão) e funcionando.

- [ ] **Passo 3: Push e abrir PR contra `develop`**

```bash
git push -u origin worktree-shadcn-ui-foundation
gh pr create --base develop --title "feat: fundacao shadcn/ui + migracao do Login" --body "$(cat <<'EOF'
## Resumo
- Instala shadcn/ui (visual padrao, CLI v4) com componentes base: button, input, select, textarea, label, badge (+ variantes ok/danger/warn/info), dialog, sheet, tabs, table, skeleton, alert, form.
- Migra Erro (basicos.tsx) para usar Alert, mantendo a mesma API.
- Extrai schemas zod de autenticacao para src/lib/schemas/auth.ts, compartilhados entre cliente (react-hook-form) e servidor (Server Actions).
- Migra LoginForm e AlterarSenhaPage para shadcn + react-hook-form + zod.
- Demais telas (Cobrancas, Visao Geral, Auditoria) ficam para sub-projetos futuros -- ver docs/superpowers/specs/2026-09-08-shadcn-ui-foundation-design.md.

## Test plan
- [x] npm run typecheck (erros remanescentes documentados, fora do escopo desta PR)
- [x] npm run build
- [x] npm run test
- [x] Teste manual do fluxo de login e alteracao de senha
EOF
)"
```

Reporte a URL da PR ao final.
