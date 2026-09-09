# Auditoria — Migração visual para shadcn/ui — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar as 4 abas da tela de Auditoria (Alterações, Usuários, Sincronizações, Qualidade dos dados) e o wrapper `badges-dominio.tsx` (compartilhado) para os componentes do shadcn/ui — `Badge` (variantes novas), `Table`, `Select`/`Field`+react-hook-form+zod nos formulários de usuários, e `Tabs` na navegação entre abas — sem mudar nenhum comportamento de negócio.

**Architecture:** Segue as decisões transversais já fixadas em `docs/superpowers/specs/2026-09-09-migracao-visual-completa-design.md`: `Badge tom→variant` (mapa fixo de cor), `.tbl`→`Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`, formulários→react-hook-form+zod com `Field`/`FieldLabel`/`FieldError`/`Controller` (mesmo padrão do Login), `Tabs` com `TabsTrigger` renderizando como `Link` real (prop `render` do Base UI) pra preservar navegação por URL.

**Tech Stack:** Next.js 15 (App Router), React 19, shadcn/ui (`Badge`, `Table`, `Select`, `Field`, `Tabs`, `Button` já instalados), react-hook-form + zod (já instalados desde a fundação).

Este é o 2º dos 5 sub-projetos da migração visual completa (o 1º, Layout, já está concluído — commits `7809fc1`/`fa505f7`/`62a6828`) — ver o design doc acima para a ordem completa.

**Regra do projeto (sem exceção):** nenhuma mensagem de commit criada por este plano deve conter linha de atribuição a IA.

---

## Pré-requisitos confirmados (não repetir)

- `src/components/ui/badge.tsx`: variantes `ok`/`danger`/`warn`/`info`/`secondary`/`default`/`outline`/`destructive`/`ghost`/`link`.
- `src/components/ui/table.tsx`: exporta `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableHead`, `TableRow`, `TableCell`, `TableCaption`.
- `src/components/ui/select.tsx`: `Select` (= `SelectPrimitive.Root`, controlado por `value`/`onValueChange`), `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`.
- `src/components/ui/field.tsx`: `Field`, `FieldLabel`, `FieldError`, `FieldGroup` (usado no Login/Alterar Senha, `docs/superpowers/plans/2026-09-08-shadcn-ui-foundation-plan.md`, Tasks 6-7).
- `src/services/authActions.ts` já tem `criarUsuarioAction(input)`, `resetarSenhaAction(userId, senha)`, `atualizarPerfilAction(input)` — chamadas DIRETAS (não via `useActionState`/`FormData` como `loginAction`), sem `redirect()` nenhuma delas. `usuarios.tsx` já embrulha as chamadas num `useTransition` próprio (`run`/`start`) — **não precisa de `startTransition` extra** (o bug do Next.js 15/React 19 encontrado no Login só ocorre com `useActionState` + `redirect()` fora de transition; nenhuma dessas 3 actions redireciona).
- `novoUsuario` (schema zod) já existe inline em `authActions.ts:38`: `z.object({ full_name: z.string().min(2), email: z.string().email(), role: z.enum(["viewer","operator","master_admin"]), senha_temporaria: z.string().min(8) })`.
- `filtros/campos.tsx` (`SelectFiltro`/`BuscaFiltro`/`LimparFiltros`, usados em `alteracoes.tsx`) **fica fora do escopo deste plano** — sua migração pro `Select` do shadcn está no sub-projeto "Cobranças — Filtros e Tabela" (é compartilhado entre Auditoria e Cobranças, mas a decisão de onde migrar é lá).

---

## Task 1: Migrar `badges-dominio.tsx` (`tom` → `variant`)

**Files:**
- Modify: `src/components/ui/badges-dominio.tsx`

Arquivo atual:

```tsx
import { Badge, type Tom } from "./badge";
import { FIN_LABEL, STATUS_LABEL, SYNC_LABEL, type FinStatus, type ProjectStatus, type StageColor, type SyncState } from "@/types/domain";
const fin: Record<FinStatus, Tom> = { not_applicable: "neutral", open: "blue", partial: "orange", paid: "green" };
const st: Record<ProjectStatus, Tom> = { active: "green", backlog: "orange", lost: "red", archived: "neutral" };
const sy: Record<SyncState, Tom> = { synchronized: "green", pending: "orange", error: "red", conflict: "red", platform_only: "neutral" };
export const BadgeFin = ({ s }: { s: FinStatus }) => <Badge tom={fin[s]}>{FIN_LABEL[s]}</Badge>;
export const BadgeSituacao = ({ s }: { s: ProjectStatus }) => <Badge tom={st[s]}>{STATUS_LABEL[s]}</Badge>;
export const BadgeSync = ({ s, erro }: { s: SyncState; erro?: string | null }) => <Badge tom={sy[s]} title={erro ?? undefined}>{SYNC_LABEL[s]}</Badge>;
export const BadgeFase = ({ code, color, pending }: { code: string | null; color: StageColor | null; pending?: boolean }) =>
  pending || !code ? <Badge tom="orange" title="Fase pendente de classificação">Pendente</Badge> : <Badge tom={color ?? "neutral"} className="font-semibold">{code}</Badge>;
export const BadgeProvisorio = () => <Badge tom="orange" title="Registro provisório (CRM / pré-base)">CRM / Pré-base</Badge>;
export const BadgeConsolidado = () => <Badge tom="neutral" title="Julho/2026 contém cobranças consolidadas de competências vencidas até junho/2026.">Consolidado</Badge>;
```

`StageColor` (importado de `@/types/domain`) é um tipo com os mesmos valores de cor (`"green"|"blue"|"orange"|"red"|"neutral"`, confirme lendo `src/types/domain.ts` se tiver dúvida) — por isso `BadgeFase` aceita `color: StageColor | null` e usa direto como `tom`.

- [ ] **Passo 1: Confirmar o arquivo real**

```bash
cat src/components/ui/badges-dominio.tsx
grep -n "StageColor" src/types/domain.ts
```

- [ ] **Passo 2: Reescrever aplicando o mapeamento `green→ok`, `red→danger`, `orange→warn`, `blue→info`, `neutral→secondary`**

```tsx
import { Badge, type badgeVariants } from "./badge";
import type { VariantProps } from "class-variance-authority";
import { FIN_LABEL, STATUS_LABEL, SYNC_LABEL, type FinStatus, type ProjectStatus, type StageColor, type SyncState } from "@/types/domain";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;
const corParaVariant: Record<StageColor, BadgeVariant> = { green: "ok", blue: "info", orange: "warn", red: "danger", neutral: "secondary" };

const fin: Record<FinStatus, StageColor> = { not_applicable: "neutral", open: "blue", partial: "orange", paid: "green" };
const st: Record<ProjectStatus, StageColor> = { active: "green", backlog: "orange", lost: "red", archived: "neutral" };
const sy: Record<SyncState, StageColor> = { synchronized: "green", pending: "orange", error: "red", conflict: "red", platform_only: "neutral" };

export const BadgeFin = ({ s }: { s: FinStatus }) => <Badge variant={corParaVariant[fin[s]]}>{FIN_LABEL[s]}</Badge>;
export const BadgeSituacao = ({ s }: { s: ProjectStatus }) => <Badge variant={corParaVariant[st[s]]}>{STATUS_LABEL[s]}</Badge>;
export const BadgeSync = ({ s, erro }: { s: SyncState; erro?: string | null }) => <Badge variant={corParaVariant[sy[s]]} title={erro ?? undefined}>{SYNC_LABEL[s]}</Badge>;
export const BadgeFase = ({ code, color, pending }: { code: string | null; color: StageColor | null; pending?: boolean }) =>
  pending || !code ? <Badge variant="warn" title="Fase pendente de classificação">Pendente</Badge> : <Badge variant={corParaVariant[color ?? "neutral"]} className="font-semibold">{code}</Badge>;
export const BadgeProvisorio = () => <Badge variant="warn" title="Registro provisório (CRM / pré-base)">CRM / Pré-base</Badge>;
export const BadgeConsolidado = () => <Badge variant="secondary" title="Julho/2026 contém cobranças consolidadas de competências vencidas até junho/2026.">Consolidado</Badge>;
```

Note: `corParaVariant` é o mapa único `StageColor → variant do Badge`, reaproveitado nas 3 tabelas (`fin`/`st`/`sy`) e nas 2 chamadas diretas — evita repetir o mapeamento 5 vezes.

- [ ] **Passo 3: Verificar tipos**

```bash
npm run typecheck
```

`badges-dominio.tsx` não deve mais aparecer na lista de erros. `qualidade.tsx`/`sincronizacoes.tsx`/`usuarios.tsx`/`acoes-master.tsx`/`auditoria/page.tsx` continuam com erro (ainda não migrados nesta task) — esperado.

- [ ] **Passo 4: Commit**

```bash
git add src/components/ui/badges-dominio.tsx
git commit -m "feat: migra badges-dominio para variantes do Badge shadcn"
```

---

## Task 1.5: Migrar `filtros/campos.tsx` (`SelectFiltro`/`BuscaFiltro`/`ToggleFiltro`/`LimparFiltros`)

**Files:**
- Modify: `src/components/filtros/campos.tsx`

**Adiantado do sub-projeto "Cobranças — Filtros e Tabela"** (usuário viu o `<select>` nativo em Auditoria e pediu pra corrigir agora — como esse arquivo é compartilhado entre Auditoria/Cobranças/Visão Geral, corrigir aqui já resolve nos 3 lugares de uma vez). Os call-sites (`auditoria/alteracoes.tsx`, `cobrancas/filtros-cobrancas.tsx`, `visao-geral/filtros-globais.tsx`) usam `SelectFiltro`/`BuscaFiltro`/`ToggleFiltro`/`LimparFiltros` só com as props `chave`/`rotulo`/`opcoes`/`todos`/`w`/`placeholder`/`ligadoQuando`/`padraoLigado` — a assinatura não muda, então nenhum call-site precisa de alteração.

Arquivo atual:

```tsx
"use client";
import { useUrlFiltros } from "./use-url-filtros";
export const SelectFiltro = ({ chave, rotulo, opcoes, todos = "Todos", w = "min-w-[130px]" }: { chave: string; rotulo: string; opcoes: { v: string; l: string }[] | string[]; todos?: string; w?: string }) => {
  const { get, set } = useUrlFiltros();
  const ops = opcoes.map((o) => (typeof o === "string" ? { v: o, l: o } : o));
  return <label className="lbl">{rotulo}<select className={`field mt-0.5 ${w}`} value={get(chave)} onChange={(e) => set({ [chave]: e.target.value })}><option value="">{todos}</option>{ops.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></label>;
};
export const BuscaFiltro = ({ chave = "q", rotulo = "Buscar", placeholder, w = "min-w-[220px]" }: { chave?: string; rotulo?: string; placeholder?: string; w?: string }) => {
  const { get, set } = useUrlFiltros();
  let t: ReturnType<typeof setTimeout>;
  return <label className="lbl">{rotulo}<input className={`field mt-0.5 ${w}`} placeholder={placeholder} defaultValue={get(chave)} onChange={(e) => { clearTimeout(t); const v = e.target.value; t = setTimeout(() => set({ [chave]: v }), 400); }} /></label>;
};
export const ToggleFiltro = ({ chave, rotulo, ligadoQuando = "1", padraoLigado = false }: { chave: string; rotulo: string; ligadoQuando?: string; padraoLigado?: boolean }) => {
  const { get, set } = useUrlFiltros();
  const atual = get(chave); const ligado = atual ? atual === ligadoQuando : padraoLigado;
  return <label className="flex h-8 items-center gap-1.5 self-end text-[12px] text-ink-muted"><input type="checkbox" checked={ligado} onChange={(e) => set({ [chave]: e.target.checked ? (padraoLigado ? "" : ligadoQuando) : (padraoLigado ? "0" : "") })} />{rotulo}</label>;
};
export const LimparFiltros = () => { const { limpar } = useUrlFiltros(); return <button onClick={limpar} className="h-8 self-end rounded px-2 text-[12px] text-ink-muted hover:bg-canvas">Limpar</button>; };
```

- [ ] **Passo 1: Confirmar o arquivo real** (`cat src/components/filtros/campos.tsx`)

- [ ] **Passo 2: Reescrever com `Select`/`Input`/`Label`/`Button` do shadcn**

```tsx
"use client";
import { useUrlFiltros } from "./use-url-filtros";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TODOS_VALUE = "__todos__";

export const SelectFiltro = ({ chave, rotulo, opcoes, todos = "Todos", w = "min-w-[130px]" }: { chave: string; rotulo: string; opcoes: { v: string; l: string }[] | string[]; todos?: string; w?: string }) => {
  const { get, set } = useUrlFiltros();
  const ops = opcoes.map((o) => (typeof o === "string" ? { v: o, l: o } : o));
  const atual = get(chave) || TODOS_VALUE;
  return (
    <div className="flex flex-col gap-0.5">
      <Label className="text-[12px] text-muted-foreground">{rotulo}</Label>
      <Select value={atual} onValueChange={(v) => set({ [chave]: v === TODOS_VALUE ? "" : v })}>
        <SelectTrigger className={w}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS_VALUE}>{todos}</SelectItem>
          {ops.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
};
export const BuscaFiltro = ({ chave = "q", rotulo = "Buscar", placeholder, w = "min-w-[220px]" }: { chave?: string; rotulo?: string; placeholder?: string; w?: string }) => {
  const { get, set } = useUrlFiltros();
  let t: ReturnType<typeof setTimeout>;
  return (
    <div className="flex flex-col gap-0.5">
      <Label className="text-[12px] text-muted-foreground">{rotulo}</Label>
      <Input className={w} placeholder={placeholder} defaultValue={get(chave)} onChange={(e) => { clearTimeout(t); const v = e.target.value; t = setTimeout(() => set({ [chave]: v }), 400); }} />
    </div>
  );
};
export const ToggleFiltro = ({ chave, rotulo, ligadoQuando = "1", padraoLigado = false }: { chave: string; rotulo: string; ligadoQuando?: string; padraoLigado?: boolean }) => {
  const { get, set } = useUrlFiltros();
  const atual = get(chave); const ligado = atual ? atual === ligadoQuando : padraoLigado;
  return <label className="flex h-8 items-center gap-1.5 self-end text-[12px] text-muted-foreground"><input type="checkbox" checked={ligado} onChange={(e) => set({ [chave]: e.target.checked ? (padraoLigado ? "" : ligadoQuando) : (padraoLigado ? "0" : "") })} />{rotulo}</label>;
};
export const LimparFiltros = () => { const { limpar } = useUrlFiltros(); return <Button type="button" variant="ghost" size="sm" onClick={limpar} className="self-end">Limpar</Button>; };
```

Note: `SelectFiltro` precisa de um valor-sentinela (`TODOS_VALUE = "__todos__"`) pro item "Todos"/"Todas" — o `Select` do shadcn (Base UI) não aceita `value=""` num `SelectItem` (usado internamente como "nada selecionado"), diferente do `<select>` nativo que aceitava `<option value="">`. O `get(chave)` continua devolvendo `""` quando o filtro não está na URL (comportamento do `useUrlFiltros` não muda) — só a tradução `""↔TODOS_VALUE` acontece na borda deste componente, então `set({[chave]: ...})` continua escrevendo `""` na URL quando o usuário escolhe "Todos" (mesmo comportamento de antes, mesma URL gerada).

`ToggleFiltro` fica com a mesma checkbox nativa (não instalamos um componente `Checkbox` do shadcn — não fazia parte da fundação, e é só esse um uso) — só a cor do texto (`text-ink-muted`→`text-muted-foreground`).

- [ ] **Passo 3: Verificar tipos**

```bash
npm run typecheck
```

Não deve haver erro em `campos.tsx`. Não deve haver NENHUM erro novo em `alteracoes.tsx`, `filtros-cobrancas.tsx`, `filtros-globais.tsx` (call-sites — assinatura de props não mudou).

- [ ] **Passo 4: Teste visual** — `npm run dev`, acessar `/auditoria?tab=alteracoes`. Confirmar: os selects ("Campo", "Ação", "Origem", "Sincronização") aparecem com o visual do shadcn (dropdown estilizado, não mais o menu nativo do navegador), escolher uma opção atualiza a URL e filtra a lista, escolher "Todos"/"Todas" de volta limpa o filtro (URL sem o parâmetro). O campo de busca (texto) e o botão "Limpar" também com visual novo.

- [ ] **Passo 5: Commit**

```bash
git add src/components/filtros/campos.tsx
git commit -m "feat: migra filtros compartilhados (Select/Input/Button) para shadcn"
```

**IMPORTANTE:** a mensagem do commit NÃO deve conter nenhuma linha de atribuição a IA.

---

## Task 2: Migrar `qualidade.tsx`

**Files:**
- Modify: `src/components/auditoria/qualidade.tsx`

Arquivo atual (linha 10 e 12 usam `tom`):

```tsx
import Link from "next/link";
import { fmtCompetencia } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { QualityIssue } from "@/types/domain";
const PENDENTES = ["ID ausente", "ID duplicado", "Status fora do catálogo", "Responsável não cadastrado", "Saldo divergente do Sheets", "Saldo zerado com situação legada Aberto", "Registro provisório possivelmente duplicado"];
export const Qualidade = ({ issues }: { issues: QualityIssue[] }) => {
  const grupos = new Map<string, QualityIssue[]>(); issues.forEach((i) => grupos.set(i.label, [...(grupos.get(i.label) ?? []), i]));
  return (
    <div className="space-y-3">
      <div className="panel px-4 py-3 text-[12px] text-ink-muted">Verificações dependentes da importação do Google Sheets (FASE 3): {PENDENTES.map((p) => <Badge key={p} tom="orange" className="mr-1">{p}</Badge>)}</div>
      {grupos.size === 0 ? <div className="panel px-4 py-8 text-center text-[13px] text-ink-faint">Nenhum problema detectado.</div> : [...grupos.entries()].map(([label, lista]) => (
        <div key={label} className="panel"><div className="panel-head"><span className="panel-title">{label}</span><Badge tom={lista.length > 0 ? "red" : "green"}>{lista.length}</Badge></div>
          <table className="tbl"><tbody>{lista.slice(0, 50).map((i, k) => <tr key={k} className="clicavel"><td><Link href={i.receivable_id ? `/cobrancas?receivable=${i.receivable_id}` : i.project_id ? `/cobrancas?q=${encodeURIComponent(i.project_name ?? "")}&status=all` : "/auditoria?tab=qualidade"} className="hover:text-action">{i.project_name ?? i.issue}</Link></td><td>{i.competence ? fmtCompetencia(i.competence) : "—"}</td></tr>)}</tbody></table>
          {lista.length > 50 && <p className="px-4 py-2 text-[11px] text-ink-faint">Mostrando 50 de {lista.length}.</p>}
        </div>))}
    </div>
  );
};
```

Este arquivo NÃO usa `badges-dominio.tsx` — usa `Badge` direto. As duas tabelas (`.tbl`) ficam de fora desta task (só a troca de `tom`→`variant` — a migração de tabela pra `Table` do shadcn é uma decisão maior que vale mais a pena revisitar quando migrarmos `alteracoes.tsx`/`usuarios.tsx`, que têm tabelas mais ricas; aqui a tabela é só 2 colunas simples — trocar agora é opcional e de baixo risco, então troque também, seguindo o Passo 2 abaixo).

- [ ] **Passo 1: Confirmar o arquivo real** (`cat src/components/auditoria/qualidade.tsx`)

- [ ] **Passo 2: Reescrever com `variant` e `Table` do shadcn**

```tsx
import Link from "next/link";
import { fmtCompetencia } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { QualityIssue } from "@/types/domain";
const PENDENTES = ["ID ausente", "ID duplicado", "Status fora do catálogo", "Responsável não cadastrado", "Saldo divergente do Sheets", "Saldo zerado com situação legada Aberto", "Registro provisório possivelmente duplicado"];
export const Qualidade = ({ issues }: { issues: QualityIssue[] }) => {
  const grupos = new Map<string, QualityIssue[]>(); issues.forEach((i) => grupos.set(i.label, [...(grupos.get(i.label) ?? []), i]));
  return (
    <div className="space-y-3">
      <div className="panel px-4 py-3 text-[12px] text-ink-muted">Verificações dependentes da importação do Google Sheets (FASE 3): {PENDENTES.map((p) => <Badge key={p} variant="warn" className="mr-1">{p}</Badge>)}</div>
      {grupos.size === 0 ? <div className="panel px-4 py-8 text-center text-[13px] text-ink-faint">Nenhum problema detectado.</div> : [...grupos.entries()].map(([label, lista]) => (
        <div key={label} className="panel"><div className="panel-head"><span className="panel-title">{label}</span><Badge variant={lista.length > 0 ? "danger" : "ok"}>{lista.length}</Badge></div>
          <Table><TableBody>{lista.slice(0, 50).map((i, k) => <TableRow key={k} className="clicavel"><TableCell><Link href={i.receivable_id ? `/cobrancas?receivable=${i.receivable_id}` : i.project_id ? `/cobrancas?q=${encodeURIComponent(i.project_name ?? "")}&status=all` : "/auditoria?tab=qualidade"} className="hover:text-action">{i.project_name ?? i.issue}</Link></TableCell><TableCell>{i.competence ? fmtCompetencia(i.competence) : "—"}</TableCell></TableRow>)}</TableBody></Table>
          {lista.length > 50 && <p className="px-4 py-2 text-[11px] text-ink-faint">Mostrando 50 de {lista.length}.</p>}
        </div>))}
    </div>
  );
};
```

Note: a classe `clicavel` (cursor de "clicável", definida em `globals.css`) continua — não é uma classe do sistema de tabela antigo (`.tbl`), é um utilitário genérico, então não precisa remover.

- [ ] **Passo 3: Verificar tipos**

```bash
npm run typecheck
```

`qualidade.tsx` não deve mais aparecer na lista.

- [ ] **Passo 4: Teste visual** — `npm run dev`, logar como `admin@teste.local`/`Teste@123`, acessar `/auditoria?tab=qualidade`. Confirme que a lista de checagens pendentes aparece com badges âmbar, e (se houver problemas de qualidade nos dados de teste) que os grupos aparecem com contagem em badge vermelho/verde.

- [ ] **Passo 5: Commit**

```bash
git add src/components/auditoria/qualidade.tsx
git commit -m "feat: migra Qualidade para Badge/Table do shadcn"
```

---

## Task 3: Migrar `sincronizacoes.tsx`

**Files:**
- Modify: `src/components/auditoria/sincronizacoes.tsx`

Arquivo atual:

```tsx
import { Pendente } from "@/components/ui/basicos";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtDataHora } from "@/lib/format";
import type { SyncRun } from "@/types/domain";
const dur = (a: string, b: string | null) => (b ? `${Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000)}s` : "—");
export const Sincronizacoes = ({ runs, fila, fonte }: { runs: SyncRun[]; fila: number; fonte: { configured: boolean; healthy: boolean; message: string } }) => (
  <div className="space-y-3">
    <div className="panel px-4 py-3">
      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <span className="font-semibold">Google Sheets</span>{fonte.configured ? <Badge tom={fonte.healthy ? "green" : "red"}>{fonte.healthy ? "Acessível" : "Erro"}</Badge> : <Pendente />}<span className="text-ink-muted">{fonte.message}</span>
        <span className="ml-auto text-ink-muted">Pendentes na fila: <b className="num">{fila}</b></span>
        <Button size="sm" disabled>Sincronizar agora</Button><Button size="sm" variant="outline" disabled>Tentar novamente</Button>
      </div>
      <p className="mt-2 text-[11.5px] text-ink-faint">Sincronização, importação e write-back são implementados nas Edge Functions da FASE 3 (health-check, preview, initialize, import, synchronize, process-sync-queue, resolve-sync-conflict). Secrets necessários: <code>GOOGLE_SERVICE_ACCOUNT_JSON</code>, <code>GOOGLE_SPREADSHEET_ID</code>.</p>
    </div>
    <div className="panel"><div className="panel-head"><span className="panel-title">Execuções</span></div>
      {runs.length === 0 ? <p className="px-4 py-8 text-center text-[13px] text-ink-faint">Nenhuma sincronização executada.</p> : <table className="tbl"><thead><tr><th>Tipo</th><th>Status</th><th>Início</th><th>Fim</th><th>Duração</th><th className="num">Lidos</th><th className="num">Criados</th><th className="num">Atualizados</th><th className="num">Ignorados</th><th className="num">Erros</th><th className="num">Conflitos</th><th>Erro</th></tr></thead><tbody>
        {runs.map((r) => <tr key={r.id}><td>{r.type}</td><td><Badge tom={r.status === "success" ? "green" : r.status === "error" ? "red" : "orange"}>{r.status}</Badge></td><td>{fmtDataHora(r.started_at)}</td><td>{fmtDataHora(r.finished_at)}</td><td>{dur(r.started_at, r.finished_at)}</td><td className="num">{r.records_read}</td><td className="num">{r.records_created}</td><td className="num">{r.records_updated}</td><td className="num">{r.records_ignored}</td><td className="num">{r.records_with_errors}</td><td className="num">{r.conflicts}</td><td className="max-w-[240px] truncate text-danger" title={r.error_message ?? ""}>{r.error_message ?? "—"}</td></tr>)}
      </tbody></table>}
    </div>
  </div>
);
```

- [ ] **Passo 1: Confirmar o arquivo real** (`cat src/components/auditoria/sincronizacoes.tsx`)

- [ ] **Passo 2: Reescrever com `variant` e `Table`**

```tsx
import { Pendente } from "@/components/ui/basicos";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDataHora } from "@/lib/format";
import type { SyncRun } from "@/types/domain";
const dur = (a: string, b: string | null) => (b ? `${Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000)}s` : "—");
export const Sincronizacoes = ({ runs, fila, fonte }: { runs: SyncRun[]; fila: number; fonte: { configured: boolean; healthy: boolean; message: string } }) => (
  <div className="space-y-3">
    <div className="panel px-4 py-3">
      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <span className="font-semibold">Google Sheets</span>{fonte.configured ? <Badge variant={fonte.healthy ? "ok" : "danger"}>{fonte.healthy ? "Acessível" : "Erro"}</Badge> : <Pendente />}<span className="text-ink-muted">{fonte.message}</span>
        <span className="ml-auto text-ink-muted">Pendentes na fila: <b className="num">{fila}</b></span>
        <Button size="sm" disabled>Sincronizar agora</Button><Button size="sm" variant="outline" disabled>Tentar novamente</Button>
      </div>
      <p className="mt-2 text-[11.5px] text-ink-faint">Sincronização, importação e write-back são implementados nas Edge Functions da FASE 3 (health-check, preview, initialize, import, synchronize, process-sync-queue, resolve-sync-conflict). Secrets necessários: <code>GOOGLE_SERVICE_ACCOUNT_JSON</code>, <code>GOOGLE_SPREADSHEET_ID</code>.</p>
    </div>
    <div className="panel"><div className="panel-head"><span className="panel-title">Execuções</span></div>
      {runs.length === 0 ? <p className="px-4 py-8 text-center text-[13px] text-ink-faint">Nenhuma sincronização executada.</p> : <Table><TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead>Início</TableHead><TableHead>Fim</TableHead><TableHead>Duração</TableHead><TableHead className="num">Lidos</TableHead><TableHead className="num">Criados</TableHead><TableHead className="num">Atualizados</TableHead><TableHead className="num">Ignorados</TableHead><TableHead className="num">Erros</TableHead><TableHead className="num">Conflitos</TableHead><TableHead>Erro</TableHead></TableRow></TableHeader><TableBody>
        {runs.map((r) => <TableRow key={r.id}><TableCell>{r.type}</TableCell><TableCell><Badge variant={r.status === "success" ? "ok" : r.status === "error" ? "danger" : "warn"}>{r.status}</Badge></TableCell><TableCell>{fmtDataHora(r.started_at)}</TableCell><TableCell>{fmtDataHora(r.finished_at)}</TableCell><TableCell>{dur(r.started_at, r.finished_at)}</TableCell><TableCell className="num">{r.records_read}</TableCell><TableCell className="num">{r.records_created}</TableCell><TableCell className="num">{r.records_updated}</TableCell><TableCell className="num">{r.records_ignored}</TableCell><TableCell className="num">{r.records_with_errors}</TableCell><TableCell className="num">{r.conflicts}</TableCell><TableCell className="max-w-[240px] truncate text-danger" title={r.error_message ?? ""}>{r.error_message ?? "—"}</TableCell></TableRow>)}
      </TableBody></Table>}
    </div>
  </div>
);
```

- [ ] **Passo 3: Verificar tipos** (`npm run typecheck` — `sincronizacoes.tsx` não deve mais aparecer)

- [ ] **Passo 4: Teste visual** — `/auditoria?tab=sincronizacoes`, confirmar badge de status do Google Sheets e da tabela de execuções (se houver alguma linha em `sync_runs` no ambiente local; se não houver, confirme só que a mensagem "Nenhuma sincronização executada." aparece corretamente).

- [ ] **Passo 5: Commit**

```bash
git add src/components/auditoria/sincronizacoes.tsx
git commit -m "feat: migra Sincronizacoes para Badge/Table do shadcn"
```

---

## Task 4: Migrar as tabelas de `alteracoes.tsx` para `Table`

**Files:**
- Modify: `src/components/auditoria/alteracoes.tsx`

Este arquivo usa `BadgeSync` (de `badges-dominio.tsx`, já migrado na Task 1 — nada a fazer com Badge aqui) e `SelectFiltro`/`BuscaFiltro`/`LimparFiltros` (de `@/components/filtros/campos.tsx` — **fora de escopo**, ficam nativos por agora, migração deles é do sub-projeto Cobranças-Filtros). Esta task só troca as 2 tabelas (`.tbl`) por `Table` do shadcn.

- [ ] **Passo 1: Confirmar o arquivo real** (`cat src/components/auditoria/alteracoes.tsx`)

- [ ] **Passo 2: Trocar a tabela principal** (dentro de `export const Alteracoes`) — troca `<table className="tbl"><thead>...</thead><tbody>...</tbody></table>` pelos componentes `Table`/`TableHeader`/`TableBody`/`TableHead`/`TableRow`/`TableCell`, mantendo TODAS as colunas, o `onClick={() => setAberto(r)}` na linha, e a classe `clicavel`:

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
```

(adicione esse import junto aos outros já existentes)

```tsx
{rows.length === 0 ? <EmptyState msg="Nenhum registro para os filtros." /> : <div className="max-h-[calc(100vh-320px)] overflow-auto"><Table><TableHeader><TableRow><TableHead>Data/Hora</TableHead><TableHead>Usuário</TableHead><TableHead>E-mail</TableHead><TableHead>Projeto</TableHead><TableHead>Competência</TableHead><TableHead>Ação</TableHead><TableHead>Campos alterados</TableHead><TableHead>Origem</TableHead><TableHead>Sincronização</TableHead></TableRow></TableHeader><TableBody>
  {rows.map((r) => <TableRow key={r.id} className="clicavel" onClick={() => setAberto(r)}><TableCell className="num">{fmtDataHora(r.occurred_at)}</TableCell><TableCell>{r.actor_name ?? (r.source === "google_sheets" ? "Alteração externa" : "sistema")}</TableCell><TableCell className="text-ink-muted">{r.actor_email ?? "—"}</TableCell><TableCell className="max-w-[220px] truncate" title={r.project_name ?? ""}>{r.project_name ?? <span className="text-ink-faint">{r.entity_type}</span>}</TableCell><TableCell>{r.competence ? fmtCompetencia(r.competence) : "—"}</TableCell><TableCell>{ACTION_LABEL[r.action_type] ?? r.action_type}</TableCell><TableCell className="max-w-[260px] truncate">{r.changed_fields.map((c) => FIELD_LABEL[c] ?? c).join(", ") || "—"}</TableCell><TableCell>{r.source}</TableCell><TableCell>{r.sync_status ? <BadgeSync s={r.sync_status} /> : "—"}</TableCell></TableRow>)}
</TableBody></Table></div>}
```

- [ ] **Passo 3: Trocar a tabela do modal "Before × After"** (dentro do `<Modal>` no final do componente):

```tsx
<div className="max-h-[50vh] overflow-auto"><Table><TableHeader><TableRow><TableHead>Campo</TableHead><TableHead>Antes</TableHead><TableHead>Depois</TableHead></TableRow></TableHeader><TableBody>
  {(aberto.changed_fields.length ? aberto.changed_fields : Object.keys(aberto.after_data ?? aberto.before_data ?? {})).map((c) => <TableRow key={c}><TableCell>{FIELD_LABEL[c] ?? c}</TableCell><TableCell className="whitespace-normal text-ink-muted">{val(aberto.before_data?.[c])}</TableCell><TableCell className="whitespace-normal font-medium">{val(aberto.after_data?.[c])}</TableCell></TableRow>)}
</TableBody></Table></div>
```

- [ ] **Passo 4: Verificar tipos e nenhum resíduo de `.tbl`**

```bash
npm run typecheck
grep -n "className=\"tbl\"" src/components/auditoria/alteracoes.tsx
```

O `grep` não deve retornar nada (as duas tabelas migraram). `alteracoes.tsx` não deve aparecer no typecheck (não tinha erro de tipo antes desta mudança — a tabela antiga era só HTML puro; confirme que a troca não introduziu nenhum).

- [ ] **Passo 5: Teste visual** — `/auditoria?tab=alteracoes`, confirmar que a lista de alterações aparece na tabela nova, clicar numa linha abre o modal "Before × After" com a segunda tabela também migrada, exportar CSV continua funcionando (botão "Exportar CSV").

- [ ] **Passo 6: Commit**

```bash
git add src/components/auditoria/alteracoes.tsx
git commit -m "feat: migra tabelas de Alteracoes para Table do shadcn"
```

---

## Task 5: Extrair schemas zod de administração de usuários

**Files:**
- Create: `src/lib/schemas/usuarios.ts`
- Modify: `src/services/authActions.ts`

Prepara o terreno pra Task 7 (formulários de `usuarios.tsx` com react-hook-form). Extrai `novoUsuario` (já existe, inline) e cria 2 schemas novos (`atualizarPerfil`, `resetarSenha`) pra ações que hoje validam informalmente.

- [ ] **Passo 1: Confirmar o arquivo real de `authActions.ts`** (`cat src/services/authActions.ts`) — se divergir do texto de referência abaixo, preserve o comportamento real, só migre a fonte de validação.

- [ ] **Passo 2: Criar `src/lib/schemas/usuarios.ts`**

```typescript
import { z } from "zod";

export const novoUsuarioSchema = z.object({
  full_name: z.string().min(2, "Informe o nome completo."),
  email: z.string().email("Informe um e-mail válido."),
  role: z.enum(["viewer", "operator", "master_admin"]),
  senha_temporaria: z.string().min(8, "Mínimo de 8 caracteres."),
});
export type NovoUsuarioInput = z.infer<typeof novoUsuarioSchema>;

export const atualizarPerfilSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().min(2, "Informe o nome completo."),
  role: z.enum(["viewer", "operator", "master_admin"]),
  active: z.boolean(),
  legacy_responsible_name: z.string().nullable(),
});
export type AtualizarPerfilInput = z.infer<typeof atualizarPerfilSchema>;

export const resetarSenhaSchema = z.object({
  senha_temporaria: z.string().min(8, "Mínimo de 8 caracteres."),
});
export type ResetarSenhaInput = z.infer<typeof resetarSenhaSchema>;
```

Note: `atualizarPerfilSchema.user_id` fica no schema (mesmo não sendo um campo do formulário visível) porque `atualizarPerfilAction` precisa dele — a Task 7 vai preencher esse campo via `defaultValues`/estado do componente, não via um `<input>` visível. `legacy_responsible_name` é `nullable()` (não `optional()`) porque o valor real é `string | null` (campo de texto que vira `null` quando vazio, ver `usuarios.tsx` atual: `legacy_responsible_name: ed.legacy || null`).

- [ ] **Passo 3: Atualizar `src/services/authActions.ts`** — importar os 3 schemas novos, usar em `criarUsuarioAction`/`resetarSenhaAction`/`atualizarPerfilAction`, removendo a definição inline de `novoUsuario` e a checagem manual `senhaTemporaria.length < 8`:

```typescript
import { novoUsuarioSchema, atualizarPerfilSchema, resetarSenhaSchema, type NovoUsuarioInput, type AtualizarPerfilInput } from "@/lib/schemas/usuarios";
```

(adicione esse import junto aos outros já existentes; remova a linha `const novoUsuario = z.object(...)`)

```typescript
export async function criarUsuarioAction(input: NovoUsuarioInput): Promise<FormState> {
  const me = await exigirPapel("master_admin");
  const s = novoUsuarioSchema.safeParse(input); if (!s.success) return { erro: s.error.issues[0].message };
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({ email: s.data.email.toLowerCase(), password: s.data.senha_temporaria, email_confirm: true,
    user_metadata: { full_name: s.data.full_name, role: s.data.role, must_change_password: true, created_by: me.user_id } });
  if (error) return { erro: error.message };
  return { ok: true }; // a senha temporária nunca é exibida de novo
}
export async function resetarSenhaAction(userId: string, senhaTemporaria: string): Promise<FormState> {
  const me = await exigirPapel("master_admin");
  const s = resetarSenhaSchema.safeParse({ senha_temporaria: senhaTemporaria }); if (!s.success) return { erro: s.error.issues[0].message };
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password: s.data.senha_temporaria });
  if (error) return { erro: error.message };
  await admin.from("profiles").update({ must_change_password: true, updated_by: me.user_id }).eq("user_id", userId);
  await admin.from("audit_logs").insert({ entity_type: "profiles", entity_id: userId, action_type: "password_reset", actor_user_id: me.user_id, actor_name: me.full_name, actor_email: me.email, source: "platform" });
  return { ok: true };
}
export async function atualizarPerfilAction(input: AtualizarPerfilInput): Promise<FormState> {
  await exigirPapel("master_admin");
  const s = atualizarPerfilSchema.safeParse(input); if (!s.success) return { erro: s.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_update_profile", { p_user_id: s.data.user_id, p_role: s.data.role, p_active: s.data.active, p_full_name: s.data.full_name, p_legacy_responsible_name: s.data.legacy_responsible_name });
  return error ? { erro: error.message } : { ok: true };
}
```

Note: `atualizarPerfilAction` ganhou validação real (antes não tinha nenhuma) — isso é uma melhoria de segurança pequena e segura (mesma regra de negócio, só passa a rejeitar entradas malformadas antes de chegar no RPC).

- [ ] **Passo 4: Verificar**

```bash
npm run typecheck
npm run test
```

Nenhum teste cobre `authActions.ts` hoje (mesma situação da Task 5 da fundação shadcn) — não precisa criar teste novo. `usuarios.tsx` (que chama essas 3 funções) vai ter erro de tipo até a Task 7 desta plano — **isso é esperado nesta task**, não corrija ainda (a Task 7 é o que ajusta os call-sites).

- [ ] **Passo 5: Commit**

```bash
git add src/lib/schemas/usuarios.ts src/services/authActions.ts
git commit -m "refactor: extrai e reforca schemas zod de administracao de usuarios"
```

---

## Task 6: Migrar Badge/Table de `usuarios.tsx` (sem tocar nos formulários ainda)

**Files:**
- Modify: `src/components/auditoria/usuarios.tsx`

Troca só a tabela principal e os `Badge`s da listagem (`tom`→`variant`). Os 3 modais (`Criar usuário`, `Editar`, `Resetar senha`) ficam pra Task 7 — nesta task eles continuam exatamente como estão (vão dar erro de tipo por causa da Task 5, isso é esperado e resolvido na Task 7).

- [ ] **Passo 1: Confirmar o arquivo real** (`cat src/components/auditoria/usuarios.tsx`)

- [ ] **Passo 2: Adicionar o import de `Table` e trocar a tabela + badges da listagem** (linhas 27-29 do arquivo original):

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
```

```tsx
<Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Perfil</TableHead><TableHead>Ativo</TableHead><TableHead>Responsável legado</TableHead><TableHead>Último acesso</TableHead><TableHead>Troca de senha</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>
  {perfis.map((p) => <TableRow key={p.user_id}><TableCell className="font-medium">{p.full_name}</TableCell><TableCell>{p.email}</TableCell><TableCell><Badge variant={p.role === "master_admin" ? "info" : "secondary"}>{ROLE_LABEL[p.role]}</Badge></TableCell><TableCell>{p.active ? <Badge variant="ok">Ativo</Badge> : <Badge variant="danger">Inativo</Badge>}</TableCell><TableCell>{p.legacy_responsible_name ?? "—"}</TableCell><TableCell>{fmtDataHora(p.last_login_at)}</TableCell><TableCell>{p.must_change_password ? <Badge variant="warn">Pendente</Badge> : "—"}</TableCell>
    <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => abrirEditar(p)}>Editar</Button><Button size="sm" variant="ghost" onClick={() => { setAlvo(p); setSenha(""); setErro(null); setModal("senha"); }}>Resetar senha</Button></TableCell></TableRow>)}
</TableBody></Table>
```

- [ ] **Passo 3: Verificar tipos**

```bash
npm run typecheck
```

`usuarios.tsx` ainda deve aparecer com erros — mas agora só relacionados às chamadas de `criarUsuarioAction`/`atualizarPerfilAction`/`resetarSenhaAction` dentro dos modais (tipos mudaram na Task 5), não mais relacionados a `tom`/`Badge`. Confirme lendo a mensagem de erro: NÃO deve mencionar `tom` nem `Tom`.

- [ ] **Passo 4: Commit**

```bash
git add src/components/auditoria/usuarios.tsx
git commit -m "feat: migra tabela e badges de Usuarios para shadcn"
```

---

## Task 7: Migrar os 3 formulários de `usuarios.tsx` para react-hook-form + zod

**Files:**
- Modify: `src/components/auditoria/usuarios.tsx`

Os 3 modais (`Criar usuário`, `Editar ...`, `Resetar senha de ...`) hoje usam `useState` manual sem validação client-side. Migra pra `useForm`+`zodResolver`+`Controller`+`Field` (mesmo padrão do Login), usando os schemas da Task 5. Como nenhuma das 3 Server Actions chama `redirect()`, e `usuarios.tsx` já embrulha as chamadas num `useTransition` próprio (`run`/`start`), **não é necessário `startTransition` extra** (diferente do Login/Alterar Senha) — o `onValid` do react-hook-form só chama `run(() => action(data), mensagem)` como já é feito hoje.

- [ ] **Passo 1: Confirmar o arquivo real** (deve já estar com a tabela/badges migrados pela Task 6)

- [ ] **Passo 2: Reescrever o componente inteiro**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Erro } from "@/components/ui/basicos";
import { fmtDataHora } from "@/lib/format";
import { atualizarPerfilAction, criarUsuarioAction, resetarSenhaAction, type FormState } from "@/services/authActions";
import { novoUsuarioSchema, atualizarPerfilSchema, resetarSenhaSchema, type NovoUsuarioInput, type AtualizarPerfilInput, type ResetarSenhaInput } from "@/lib/schemas/usuarios";
import { ROLE_LABEL, type AppRole, type Profile } from "@/types/domain";

const PAPEIS = Object.entries(ROLE_LABEL) as [AppRole, string][];

export const Usuarios = ({ perfis, responsaveisLegados }: { perfis: Profile[]; responsaveisLegados: string[] }) => {
  const router = useRouter(); const [pending, start] = useTransition();
  const [modal, setModal] = useState<"novo" | "editar" | "senha" | null>(null); const [alvo, setAlvo] = useState<Profile | null>(null);
  const [erro, setErro] = useState<string | null>(null); const [ok, setOk] = useState<string | null>(null);
  const run = (fn: () => Promise<FormState>, msg: string) => start(async () => { const r = await fn(); if (r.erro) { setErro(r.erro); return; } setErro(null); setOk(msg); setModal(null); router.refresh(); });
  const abrirEditar = (p: Profile) => { setAlvo(p); setErro(null); setModal("editar"); };

  const novoForm = useForm<NovoUsuarioInput>({ resolver: zodResolver(novoUsuarioSchema), defaultValues: { full_name: "", email: "", role: "viewer", senha_temporaria: "" } });
  const editarForm = useForm<AtualizarPerfilInput>({ resolver: zodResolver(atualizarPerfilSchema) });
  const senhaForm = useForm<ResetarSenhaInput>({ resolver: zodResolver(resetarSenhaSchema), defaultValues: { senha_temporaria: "" } });

  const abrirNovo = () => { novoForm.reset({ full_name: "", email: "", role: "viewer", senha_temporaria: "" }); setErro(null); setModal("novo"); };
  const abrirEditarComReset = (p: Profile) => { editarForm.reset({ user_id: p.user_id, full_name: p.full_name, role: p.role, active: p.active, legacy_responsible_name: p.legacy_responsible_name ?? null }); abrirEditar(p); };
  const abrirSenha = (p: Profile) => { senhaForm.reset({ senha_temporaria: "" }); setAlvo(p); setErro(null); setModal("senha"); };

  return (<>
    <div className="panel">
      <div className="panel-head"><span className="panel-title">Usuários <span className="num font-normal text-ink-faint">({perfis.length})</span></span><Button size="sm" onClick={abrirNovo}>Criar usuário</Button></div>
      {ok && <p className="px-4 pt-2 text-[12px] text-ok">{ok}</p>}
      <Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Perfil</TableHead><TableHead>Ativo</TableHead><TableHead>Responsável legado</TableHead><TableHead>Último acesso</TableHead><TableHead>Troca de senha</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>
        {perfis.map((p) => <TableRow key={p.user_id}><TableCell className="font-medium">{p.full_name}</TableCell><TableCell>{p.email}</TableCell><TableCell><Badge variant={p.role === "master_admin" ? "info" : "secondary"}>{ROLE_LABEL[p.role]}</Badge></TableCell><TableCell>{p.active ? <Badge variant="ok">Ativo</Badge> : <Badge variant="danger">Inativo</Badge>}</TableCell><TableCell>{p.legacy_responsible_name ?? "—"}</TableCell><TableCell>{fmtDataHora(p.last_login_at)}</TableCell><TableCell>{p.must_change_password ? <Badge variant="warn">Pendente</Badge> : "—"}</TableCell>
          <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => abrirEditarComReset(p)}>Editar</Button><Button size="sm" variant="ghost" onClick={() => abrirSenha(p)}>Resetar senha</Button></TableCell></TableRow>)}
      </TableBody></Table>
    </div>

    <Modal aberto={modal === "novo"} titulo="Criar usuário" onFechar={() => setModal(null)} largura="max-w-md">
      <form onSubmit={novoForm.handleSubmit((data) => run(() => criarUsuarioAction(data), `Usuário ${data.email} criado.`))}>
        <FieldGroup>
          <Controller control={novoForm.control} name="full_name" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Nome</FieldLabel><Input id={field.name} {...field} /><FieldError errors={[fieldState.error]} /></Field>
          )} />
          <Controller control={novoForm.control} name="email" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>E-mail</FieldLabel><Input id={field.name} type="email" {...field} /><FieldError errors={[fieldState.error]} /></Field>
          )} />
          <Controller control={novoForm.control} name="role" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Perfil</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}><SelectTrigger id={field.name} className="w-full"><SelectValue /></SelectTrigger><SelectContent>{PAPEIS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
              <FieldError errors={[fieldState.error]} /></Field>
          )} />
          <Controller control={novoForm.control} name="senha_temporaria" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Senha temporária (mín. 8)</FieldLabel><Input id={field.name} type="text" autoComplete="off" {...field} /><FieldError errors={[fieldState.error]} /></Field>
          )} />
          <p className="text-[11px] text-ink-faint">O usuário deverá trocar a senha no primeiro acesso. A senha temporária não será exibida novamente — copie-a agora.</p>
          <Erro msg={erro} /><div className="flex justify-end"><Button type="submit" disabled={pending}>Criar</Button></div>
        </FieldGroup>
      </form>
    </Modal>

    <Modal aberto={modal === "editar"} titulo={`Editar ${alvo?.full_name ?? ""}`} onFechar={() => setModal(null)} largura="max-w-md">
      <form onSubmit={editarForm.handleSubmit((data) => run(() => atualizarPerfilAction(data), "Usuário atualizado."))}>
        <FieldGroup>
          <Controller control={editarForm.control} name="full_name" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Nome</FieldLabel><Input id={field.name} {...field} /><FieldError errors={[fieldState.error]} /></Field>
          )} />
          <Controller control={editarForm.control} name="role" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Perfil</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}><SelectTrigger id={field.name} className="w-full"><SelectValue /></SelectTrigger><SelectContent>{PAPEIS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
              <FieldError errors={[fieldState.error]} /></Field>
          )} />
          <Controller control={editarForm.control} name="active" render={({ field }) => (
            <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />Ativo</label>
          )} />
          <Controller control={editarForm.control} name="legacy_responsible_name" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Vincular a responsável legado (texto da planilha)</FieldLabel>
              <Input id={field.name} list="legados" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} /><datalist id="legados">{responsaveisLegados.map((r) => <option key={r} value={r} />)}</datalist>
              <FieldError errors={[fieldState.error]} /></Field>
          )} />
          <Erro msg={erro} /><div className="flex justify-end"><Button type="submit" disabled={pending}>Salvar</Button></div>
        </FieldGroup>
      </form>
    </Modal>

    <Modal aberto={modal === "senha"} titulo={`Resetar senha de ${alvo?.full_name ?? ""}`} onFechar={() => setModal(null)} largura="max-w-md">
      <form onSubmit={senhaForm.handleSubmit((data) => alvo && run(() => resetarSenhaAction(alvo.user_id, data.senha_temporaria), "Senha resetada."))}>
        <FieldGroup>
          <Controller control={senhaForm.control} name="senha_temporaria" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Nova senha temporária (mín. 8)</FieldLabel><Input id={field.name} type="text" autoComplete="off" {...field} /><FieldError errors={[fieldState.error]} /></Field>
          )} />
          <p className="text-[11px] text-ink-faint">O usuário será obrigado a trocar a senha no próximo login.</p>
          <Erro msg={erro} /><div className="flex justify-end"><Button type="submit" disabled={pending}>Resetar</Button></div>
        </FieldGroup>
      </form>
    </Modal>
  </>);
};
```

Note importante: `abrirEditarComReset` chama `editarForm.reset({...})` ANTES de `setModal("editar")` (via `abrirEditar`) — isso preenche o formulário com os dados do usuário clicado antes do modal abrir, substituindo o antigo padrão `setEd({...})`. O mesmo vale para `abrirSenha` (reseta o campo de senha vazio) e `abrirNovo` (reseta o formulário de criação pro estado inicial, já que agora o `useForm` mantém estado entre aberturas do modal).

- [ ] **Passo 3: Verificar tipos**

```bash
npm run typecheck
```

`usuarios.tsx` não deve mais aparecer na lista de erros.

- [ ] **Passo 4: Testar manualmente no navegador** — logar como `admin@teste.local`/`Teste@123`, ir em `/auditoria?tab=usuarios`:
  - **Criar usuário**: deixar campos vazios e submeter → erros client-side instantâneos por campo (nome, e-mail, senha). Preencher com um e-mail já existente → erro do servidor (`state.erro`) aparece via `Erro`. Preencher tudo válido com um e-mail novo → cria e a lista atualiza (`router.refresh()`), mensagem de sucesso aparece.
  - **Editar**: abrir um usuário existente, confirmar que os campos vêm preenchidos com os dados atuais (nome, perfil, ativo, responsável legado), trocar o nome pra algo inválido (1 caractere) → erro client-side; salvar com dado válido → atualiza.
  - **Resetar senha**: abrir, senha curta (<8) → erro client-side; senha válida → reseta, mensagem de sucesso.
  - Depois dos testes, se tiver criado um usuário de teste extra, pode deixar (não precisa limpar) — só não deixe o usuário `admin@teste.local` num estado alterado (perfil/senha).

- [ ] **Passo 5: Commit**

```bash
git add src/components/auditoria/usuarios.tsx
git commit -m "feat: migra formularios de Usuarios para shadcn + react-hook-form"
```

---

## Task 8: Migrar `Tabs` de `auditoria/page.tsx`

**Files:**
- Modify: `src/app/(app)/auditoria/page.tsx`

Troca o componente `Tabs` customizado (props `itens`/`atual`/`base`) pelo `Tabs`/`TabsList`/`TabsTrigger` do shadcn, com cada `TabsTrigger` renderizando como um `Link` real (prop `render`, ver `docs/superpowers/specs/2026-09-09-migracao-visual-completa-design.md`, seção "Tabs (Auditoria)") — preserva navegação por URL e conteúdo renderizado no servidor via `searchParams`.

- [ ] **Passo 1: Confirmar o arquivo real** (`cat "src/app/(app)/auditoria/page.tsx"`)

- [ ] **Passo 2: Trocar o import e o uso do `Tabs`**

```tsx
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
```

(o `import { Tabs } from "@/components/ui/tabs";` antigo já existe — só adicione `TabsList`/`TabsTrigger` e o `Link`)

```tsx
<Tabs value={tab}>
  <TabsList>
    {TABS.map((t) => <TabsTrigger key={t.id} value={t.id} render={<Link href={`/auditoria?tab=${t.id}`} />}>{t.label}</TabsTrigger>)}
  </TabsList>
</Tabs>
```

(substitui a linha `<Tabs itens={TABS} atual={tab} base="/auditoria" />`)

- [ ] **Passo 3: Verificar tipos**

```bash
npm run typecheck
```

`auditoria/page.tsx` não deve mais aparecer na lista de erros.

- [ ] **Passo 4: Teste visual e funcional** — `/auditoria`, confirmar: as 4 abas aparecem com o visual do shadcn (pílulas/sublinhado), a aba atual aparece destacada (`value={tab}` bate com a URL), clicar em cada aba navega de verdade (URL muda pra `?tab=usuarios` etc, sem recarregar a página inteira — é um `Link` do Next), o conteúdo certo aparece em cada aba, e o botão "voltar" do navegador funciona (prova de que é navegação real, não estado client-side).

- [ ] **Passo 5: Commit**

```bash
git add "src/app/(app)/auditoria/page.tsx"
git commit -m "feat: migra Tabs de Auditoria para shadcn com navegacao real por Link"
```

---

## Task 9: Verificação final do sub-projeto Auditoria

**Files:** nenhum (task de verificação)

- [ ] **Passo 1: Rodar a suite**

```bash
npm run lint
npm run typecheck
npm run test
```

Nenhum arquivo de `src/components/auditoria/` ou `src/app/(app)/auditoria/` deve aparecer no `typecheck`. Os arquivos do sub-projeto Cobranças (ainda não migrado) continuam aparecendo — esperado.

- [ ] **Passo 2: Teste manual completo** — navegar pelas 4 abas de Auditoria, testar os 3 formulários de Usuários de ponta a ponta (criar, editar, resetar senha), confirmar visualmente que Badge/Table/Tabs estão consistentes com o visual do Login/Layout já migrados.

- [ ] **Passo 3: Relatar** quais arquivos ainda aparecem no `typecheck` (devem ser só os do sub-projeto Cobranças: `acoes-master.tsx`, e o que mais surgir de `filtros-cobrancas.tsx`/`tabela.tsx`/etc quando chegar a vez).

Não iniciar o próximo sub-projeto (Visão Geral) automaticamente — plano novo, escrito separadamente.
