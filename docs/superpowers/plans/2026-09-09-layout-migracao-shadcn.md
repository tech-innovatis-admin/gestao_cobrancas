# Layout (Sidebar/Topbar) — Migração visual para shadcn/ui — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar o visual do `Sidebar` e do `Topbar` (hoje no tema "navy institucional" antigo) para os tokens de cor neutros do shadcn/ui, e trocar o botão de logout do Topbar pelo componente `Button` do shadcn — sem mudar nenhum comportamento (navegação, estado ativo, dados exibidos).

**Architecture:** Troca pontual de classes Tailwind (tokens de cor `bg-navy`/`text-white`/`border-line`/`text-ink-faint` etc. pelos tokens `bg-sidebar`/`text-sidebar-foreground`/`border-border`/`text-muted-foreground` etc., já disponíveis em `src/app/globals.css` desde a Task 2 da fundação shadcn — confirmado via `grep -n "sidebar" src/app/globals.css`, que já definia `--sidebar`, `--sidebar-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`). Nenhuma lógica (`Link`/`usePathname`, busca de `ultimaSync`, `logoutAction`) muda. `Badge` no Topbar troca a prop `tom` (removida na Task 3 da fundação) por `variant`.

**Tech Stack:** Next.js 15 (App Router), Tailwind CSS 4, shadcn/ui (componentes `Badge`, `Button` já instalados).

Este é o primeiro dos 5 sub-projetos da migração visual completa — ver `docs/superpowers/specs/2026-09-09-migracao-visual-completa-design.md` para o desenho geral e a ordem dos demais (Auditoria → Visão Geral → Cobranças-Filtros → Cobranças-Ações do Master Admin).

**Regra do projeto (sem exceção):** nenhuma mensagem de commit criada por este plano deve conter linha de atribuição a IA (nem "Co-Authored-By", nem nada parecido).

---

## Pré-requisitos confirmados (não repetir)

- Fundação shadcn/ui já instalada (worktree `worktree-shadcn-ui-foundation`, branch atual). `Badge` (com variantes `ok`/`danger`/`warn`/`info`/`secondary`/`default`/`outline`/etc.) e `Button` (variantes `default`/`outline`/`secondary`/`ghost`/`destructive`/`link`) já existem em `src/components/ui/badge.tsx` e `src/components/ui/button.tsx`.
- `src/app/globals.css` já define os tokens `--color-sidebar`, `--color-sidebar-foreground`, `--color-sidebar-accent`, `--color-sidebar-accent-foreground`, `--color-sidebar-border`, `--color-background`, `--color-foreground`, `--color-border`, `--color-muted-foreground` (gerados pelo `shadcn init` na Task 2 da fundação, mesmo sem o componente `Sidebar` completo do shadcn ter sido instalado).
- `src/services/auditService.ts:40` — `ultimaSync()` retorna `Promise<{ status: string; started_at?: string; finished_at?: string }>`.

---

## Task 1: Migrar `Sidebar` para os tokens neutros do shadcn

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

Arquivo atual (11 linhas relevantes, dentro de `export const Sidebar`):

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListChecks, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/types/domain";
const itens = [
  { href: "/visao-geral", label: "Visão Geral", icon: LayoutDashboard, master: false },
  { href: "/cobrancas", label: "Cobranças", icon: ListChecks, master: false },
  { href: "/auditoria", label: "Auditoria", icon: ShieldCheck, master: true },
];
export const Sidebar = ({ role }: { role: AppRole }) => {
  const path = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-52 flex-col bg-navy text-white">
      <div className="border-b border-white/10 px-5 py-5"><div className="text-[15px] font-bold tracking-wide">INNOVATIS</div><div className="text-[12px] text-white/70">Gestão de Cobranças</div></div>
      <nav className="flex-1 px-3 py-4">
        {itens.filter((i) => !i.master || role === "master_admin").map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={cn("mb-1 flex items-center gap-2.5 rounded px-3 py-2 text-[13px]", path.startsWith(href) ? "bg-white/10 font-medium text-white" : "text-white/70 hover:bg-white/5 hover:text-white")}><Icon size={15} strokeWidth={1.75} />{label}</Link>
        ))}
      </nav>
      <div className="border-t border-white/10 px-5 py-3 text-[11px] text-white/40">V0 · uso interno</div>
    </aside>
  );
};
```

- [ ] **Passo 1: Confirmar o arquivo real antes de editar**

```bash
cat src/components/layout/sidebar.tsx
```

Se divergir do texto acima, use o conteúdo real como base — o texto acima é referência de como o arquivo estava no momento em que este plano foi escrito.

- [ ] **Passo 2: Substituir só as classes de cor** (`Link`, `usePathname`, `cn`, a lista `itens`, o filtro por `role` — nada disso muda):

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListChecks, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/types/domain";
const itens = [
  { href: "/visao-geral", label: "Visão Geral", icon: LayoutDashboard, master: false },
  { href: "/cobrancas", label: "Cobranças", icon: ListChecks, master: false },
  { href: "/auditoria", label: "Auditoria", icon: ShieldCheck, master: true },
];
export const Sidebar = ({ role }: { role: AppRole }) => {
  const path = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-52 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-5 py-5"><div className="text-[15px] font-bold tracking-wide">INNOVATIS</div><div className="text-[12px] text-muted-foreground">Gestão de Cobranças</div></div>
      <nav className="flex-1 px-3 py-4">
        {itens.filter((i) => !i.master || role === "master_admin").map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={cn("mb-1 flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px]", path.startsWith(href) ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground")}><Icon size={15} strokeWidth={1.75} />{label}</Link>
        ))}
      </nav>
      <div className="border-t border-sidebar-border px-5 py-3 text-[11px] text-muted-foreground">V0 · uso interno</div>
    </aside>
  );
};
```

Mudanças: `bg-navy text-white` → `bg-sidebar text-sidebar-foreground` (+ borda `border-r border-sidebar-border`, o painel agora é claro e precisa de uma borda pra se separar do conteúdo — no navy antigo o contraste de cor já fazia esse papel); `border-white/10` → `border-sidebar-border`; `text-white/70` → `text-muted-foreground`; item ativo `bg-white/10 text-white` → `bg-sidebar-accent text-sidebar-accent-foreground`; item inativo hover `hover:bg-white/5 hover:text-white` → `hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground`; `text-white/40` (rodapé) → `text-muted-foreground`; `rounded` → `rounded-md` (consistente com o raio usado pelos outros componentes shadcn instalados).

- [ ] **Passo 3: Rodar o app e confirmar visualmente**

```bash
npm run dev
```

Acesse qualquer página logada (ex: `/visao-geral`, login `admin@teste.local`/`Teste@123`). Confirme: menu lateral aparece com fundo claro (não mais navy escuro), item da página atual destacado, hover nos outros itens funcionando, texto "INNOVATIS" e "V0 · uso interno" legíveis.

- [ ] **Passo 4: Verificar tipos**

```bash
npm run typecheck
```

Não deve haver nenhum erro em `sidebar.tsx` (não havia antes desta mudança, e a troca é só de classes CSS).

- [ ] **Passo 5: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: migra Sidebar para os tokens neutros do shadcn/ui"
```

A mensagem do commit NÃO deve conter linha de atribuição a IA.

---

## Task 2: Migrar `Topbar` para os tokens neutros do shadcn e o `Button`/`Badge` novos

**Files:**
- Modify: `src/components/layout/topbar.tsx`

Arquivo atual:

```tsx
import { LogOut } from "lucide-react";
import { logoutAction } from "@/services/authActions";
import { ultimaSync } from "@/services/auditService";
import { fmtDataHora } from "@/lib/format";
import { Badge, type Tom } from "@/components/ui/badge";
import { ROLE_LABEL, type Profile } from "@/types/domain";
const tomSync: Record<string, [Tom, string]> = { success: ["green", "Sincronizado"], running: ["orange", "Pendente"], partial: ["orange", "Pendente"], error: ["red", "Erro"], not_configured: ["orange", "Configuração pendente"] };
export const Topbar = async ({ titulo, perfil, extra }: { titulo: string; perfil: Profile; extra?: React.ReactNode }) => {
  const s = await ultimaSync(); const [tom, label] = tomSync[s.status] ?? ["neutral", s.status];
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-line bg-white px-6">
      <div className="flex items-center gap-4"><h1 className="text-[16px] font-semibold text-navy">{titulo}</h1>{extra}</div>
      <div className="flex items-center gap-5">
        <div className="text-right text-[11px] text-ink-faint">Última sincronização<div className="flex items-center justify-end gap-1.5 text-ink"><Badge tom={tom}>{label}</Badge>{s.finished_at && <span>{fmtDataHora(s.finished_at)}</span>}</div></div>
        <div className="text-right leading-tight"><div className="text-[13px] font-medium">{perfil.full_name}</div><div className="text-[11px] text-ink-faint">{perfil.email} · {ROLE_LABEL[perfil.role]}</div></div>
        <form action={logoutAction}><button className="rounded p-1.5 text-ink-faint hover:bg-canvas hover:text-ink" title="Sair"><LogOut size={15} /></button></form>
      </div>
    </header>
  );
};
```

`Badge` não exporta mais o tipo `Tom` (removido quando a fundação shadcn sobrescreveu `badge.tsx` na Task 2) — é exatamente o erro de tipo já conhecido (`Module '"@/components/ui/badge"' has no exported member 'Tom'`).

- [ ] **Passo 1: Confirmar o arquivo real antes de editar**

```bash
cat src/components/layout/topbar.tsx
```

- [ ] **Passo 2: Reescrever com `variant` no lugar de `tom`, tokens neutros, e `Button` no lugar do `<button>` nativo**

```tsx
import { LogOut } from "lucide-react";
import { logoutAction } from "@/services/authActions";
import { ultimaSync } from "@/services/auditService";
import { fmtDataHora } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL, type Profile } from "@/types/domain";

type SyncBadgeVariant = "ok" | "warn" | "danger" | "secondary";
const tomSync: Record<string, [SyncBadgeVariant, string]> = {
  success: ["ok", "Sincronizado"],
  running: ["warn", "Pendente"],
  partial: ["warn", "Pendente"],
  error: ["danger", "Erro"],
  not_configured: ["warn", "Configuração pendente"],
};

export const Topbar = async ({ titulo, perfil, extra }: { titulo: string; perfil: Profile; extra?: React.ReactNode }) => {
  const s = await ultimaSync();
  const [variant, label] = tomSync[s.status] ?? ["secondary", s.status];
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-4"><h1 className="text-[16px] font-semibold text-foreground">{titulo}</h1>{extra}</div>
      <div className="flex items-center gap-5">
        <div className="text-right text-[11px] text-muted-foreground">Última sincronização<div className="flex items-center justify-end gap-1.5 text-foreground"><Badge variant={variant}>{label}</Badge>{s.finished_at && <span>{fmtDataHora(s.finished_at)}</span>}</div></div>
        <div className="text-right leading-tight"><div className="text-[13px] font-medium">{perfil.full_name}</div><div className="text-[11px] text-muted-foreground">{perfil.email} · {ROLE_LABEL[perfil.role]}</div></div>
        <form action={logoutAction}><Button type="submit" variant="ghost" size="icon" title="Sair"><LogOut size={15} /></Button></form>
      </div>
    </header>
  );
};
```

Mapeamento de cor aplicado (igual ao definido no design doc): `green→ok`, `orange→warn`, `red→danger`, fallback `neutral→secondary`. `bg-white`→`bg-background`, `text-navy`→`text-foreground`, `border-line`→`border-border`, `text-ink-faint`→`text-muted-foreground`, `text-ink`→`text-foreground`. O botão de logout passa a ser o `Button` do shadcn (`variant="ghost" size="icon"`, que já inclui o padrão de hover/foco do design system) em vez do `<button>` com classes manuais.

- [ ] **Passo 3: Verificar tipos**

```bash
npm run typecheck
```

Não deve haver mais nenhum erro em `topbar.tsx` (os 2 erros conhecidos desse arquivo — `Module has no exported member 'Tom'` e o uso de `tom` como prop — devem ter desaparecido). Os erros nos OUTROS arquivos ainda não migrados (`auditoria/page.tsx`, `qualidade.tsx`, `sincronizacoes.tsx`, `usuarios.tsx`, `acoes-master.tsx`, `badges-dominio.tsx`) continuam esperados — não fazem parte deste sub-projeto.

- [ ] **Passo 4: Rodar o app e confirmar visualmente**

```bash
npm run dev
```

Acesse `/visao-geral` (ou qualquer página logada). Confirme: cabeçalho com fundo claro (não mais branco puro sobre navy — agora é o "background" padrão do tema, que também é claro, então a diferença visual é sutil aqui, mas a fonte de cor é a certa), badge de "última sincronização" aparecendo com a cor certa (verde/âmbar/vermelho conforme o status atual do ambiente local), botão de logout (ícone de saída) com o hover do shadcn.

- [ ] **Passo 5: Commit**

```bash
git add src/components/layout/topbar.tsx
git commit -m "feat: migra Topbar para Badge/Button/tokens neutros do shadcn/ui"
```

A mensagem do commit NÃO deve conter linha de atribuição a IA.

---

## Task 3: Verificação final do sub-projeto Layout

**Files:** nenhum (task de verificação)

- [ ] **Passo 1: Rodar a suite**

```bash
npm run lint
npm run typecheck
npm run test
```

`typecheck` deve mostrar os erros pré-existentes SEM `sidebar.tsx`/`topbar.tsx` na lista (esses dois arquivos não devem aparecer mais). Os demais arquivos ainda não migrados continuam com erro — isso é esperado, fazem parte dos próximos sub-projetos (ver `docs/superpowers/specs/2026-09-09-migracao-visual-completa-design.md`).

- [ ] **Passo 2: Teste manual** — navegar por `/visao-geral`, `/cobrancas`, `/auditoria` (logado como `admin@teste.local`/`Teste@123`) confirmando que o Sidebar/Topbar aparecem consistentes (visual neutro) em todas, e que navegar entre elas continua funcionando (item ativo do menu muda corretamente).

- [ ] **Passo 3: Relatar no final** quais arquivos ainda aparecem no `typecheck` (devem ser os mesmos 5 já conhecidos: `auditoria/page.tsx`, `qualidade.tsx`, `sincronizacoes.tsx`, `usuarios.tsx`, `acoes-master.tsx`, `badges-dominio.tsx` — 6, não 5, contando `badges-dominio.tsx`), confirmando que a lista só diminuiu (perdeu `topbar.tsx`) e não aumentou.

Não faz commit nesta task (é só verificação). Ao final, NÃO iniciar o próximo sub-projeto (Auditoria) automaticamente — esse é um plano novo, escrito separadamente.
