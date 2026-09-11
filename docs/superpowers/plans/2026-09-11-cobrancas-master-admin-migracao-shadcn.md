# Cobranças — Ações do Master Admin — Migração visual para shadcn/ui — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar `src/components/cobrancas/acoes-master.tsx` (painel de ações do Master Admin — 7 formulários em modais) pro shadcn/ui: `Modal` customizado → `Dialog`, `<select>`/`<input>`/`<textarea>` → `Select`/`Input`/`Textarea` + react-hook-form+zod, `Button variant="danger"/"primary"` → `"destructive"/"default"`. **Este é o último sub-projeto** — ao final, `npm run lint`/`typecheck`/`test`/`build` devem passar 100% limpos em todo o projeto.

**Architecture:** Mesmos padrões já validados nos sub-projetos anteriores (Field/FieldLabel/FieldError/Controller, valor-sentinela pra Select, `SelectValue` com resolvedor de rótulo). Os schemas zod hoje inline em `src/services/receivablesActions.ts` (`operacional` — já usado, `recibo`, `financeiro`, `novoRecebivel`) e os novos necessários (`editarProjeto`, `alterarFase`, `alterarSituacao`, `motivo`) vão pra `src/lib/schemas/receivables-admin.ts` — **nunca exportar um schema zod de um arquivo `"use server"`** (isso quebrou `/cobrancas` inteira numa task anterior, commit `24e5868` do sub-projeto anterior — o Next.js só permite exportar `async function` de módulos `"use server"`). `Modal`→`Dialog`: mesmo raciocínio já usado em `Drawer`→`Sheet` (sub-projeto anterior).

Duas validações condicionais reais precisam de `.superRefine()` — não são só wiring mecânico:
- **Alterar Situação**: ao reativar um projeto "Perdido" pra "Ativo", a fase e a justificativa passam a ser obrigatórias (hoje isso é feito com `if`s manuais no `onSalvar`).
- **Registrar recebimento**: quando o valor recebido supera o previsto, o checkbox "Confirmo que o valor está correto" e a justificativa passam a ser obrigatórios.

**Tech Stack:** Next.js 15, React 19, shadcn/ui (`Dialog`, `Select`, `Input`, `Textarea`, `Field`, `Button` já instalados), react-hook-form + zod.

**Regra do projeto (sem exceção):** nenhuma mensagem de commit criada por este plano deve conter linha de atribuição a IA.

---

## Pré-requisitos confirmados (não repetir)

- `src/components/ui/dialog.tsx`: `Dialog` (= `Dialog.Root`, `open`/`onOpenChange`), `DialogContent` (`sm:max-w-sm` por padrão — precisa de override de largura por modal, mesmo raciocínio do `Sheet`), `DialogHeader`, `DialogTitle`, `DialogFooter`.
- `src/components/ui/modal.tsx` (`Modal` customizado, `aberto`/`titulo`/`onFechar`/`largura`) será totalmente substituído — depois da última task deste plano, esse arquivo fica sem uso (pode ser removido na Task 2, se `grep -rn "from \"@/components/ui/modal\"" src` não mostrar mais nenhum outro call-site — confirme antes de decidir).
- `src/lib/format.ts`: `parseBRL(s: string): number` (nunca lança erro, retorna `0` em entrada inválida — não há validação de formato de moeda hoje, então os schemas novos não precisam impor uma).
- Gotcha do `SelectValue` (função resolvedora como `children`) e valor-sentinela pra representar "vazio"/`null` num `Select` — padrão já usado em 4 tasks anteriores.
- `receivablesActions.ts` hoje: `operacional` (usado por `salvarOperacional`, já migrado), `recibo` (usado por `registrarRecebimento`), `financeiro` (usado por `salvarFinanceiro`), `novoRecebivel` (usado por `criarRecebivel`) — todos inline, não exportados. `criarProjeto`/`editarProjeto` usam `projetoSchema`/`ProjetoInput` de `@/lib/schemas/projetos.ts` (já extraído). `alterarFase`/`alterarSituacao`/`excluirDaGestao`/`restaurarProjeto` recebem argumentos posicionais simples, sem schema zod hoje.

---

## Task 1: Extrair e criar schemas zod em `src/lib/schemas/receivables-admin.ts`

**Files:**
- Create: `src/lib/schemas/receivables-admin.ts`
- Modify: `src/services/receivablesActions.ts`

- [ ] **Passo 1: Confirmar o arquivo real** (`cat src/services/receivablesActions.ts`)

- [ ] **Passo 2: Criar `src/lib/schemas/receivables-admin.ts`**

```typescript
import { z } from "zod";
import { parseBRL } from "@/lib/format";

export const editarProjetoSchema = z.object({
  name: z.string().min(2, "Informe o nome do projeto."),
  hub: z.enum(["IFES", "GOV"]),
  ministry_government: z.string().nullable(),
  institute: z.string().nullable(),
  foundation: z.string().nullable(),
  origin: z.enum(["google_sheets", "crm", "platform", "future_financial_database"]),
  provisional: z.boolean(),
  notes: z.string().nullable(),
});
export type EditarProjetoInput = z.infer<typeof editarProjetoSchema>;

export const alterarFaseSchema = z.object({
  stage_code: z.enum(["A", "B", "C", "D"]),
  justification: z.string().nullable(),
});
export type AlterarFaseInput = z.infer<typeof alterarFaseSchema>;

/** `statusOriginal` vem do recebível aberto no momento — reativar um "lost" pra "active" exige fase + justificativa. */
export const alterarSituacaoSchema = (statusOriginal: "active" | "backlog" | "lost" | "archived") =>
  z.object({
    status: z.enum(["active", "backlog", "lost"]),
    justification: z.string().nullable(),
    stage_code: z.string().nullable(),
  }).superRefine((d, ctx) => {
    const reativando = statusOriginal === "lost" && d.status === "active";
    if (reativando && !d.stage_code) ctx.addIssue({ code: "custom", path: ["stage_code"], message: "Selecione a fase para reativar." });
    if (reativando && !d.justification) ctx.addIssue({ code: "custom", path: ["justification"], message: "Justificativa obrigatória ao reativar um perdido." });
  });
export type AlterarSituacaoInput = z.infer<ReturnType<typeof alterarSituacaoSchema>>;

export const financeiroFormSchema = z.object({
  pp: z.string(), pi: z.string(), rp: z.string(), ri: z.string(),
  competence: z.string().min(1, "Informe a competência."),
  flag: z.string().nullable(),
  origin: z.enum(["google_sheets", "crm", "platform", "future_financial_database"]),
  provisional: z.boolean(),
  legacy_consolidated: z.boolean(),
  justification: z.string().nullable(),
});
export type FinanceiroFormInput = z.infer<typeof financeiroFormSchema>;

/** `plannedProject`/`plannedInnovatis` vêm do recebível aberto — recebido > previsto exige confirmação + justificativa. */
export const reciboFormSchema = (plannedProject: number, plannedInnovatis: number) =>
  z.object({
    rp: z.string(), ri: z.string(),
    data: z.string(), nf: z.string(), note: z.string(), just: z.string(),
    confirmar: z.boolean(),
  }).superRefine((d, ctx) => {
    const rp = parseBRL(d.rp), ri = parseBRL(d.ri);
    const excede = rp > plannedProject + 0.01 || ri > plannedInnovatis + 0.01;
    if (excede && !d.confirmar) ctx.addIssue({ code: "custom", path: ["confirmar"], message: "Confirme que o valor está correto." });
    if (excede && !d.just.trim()) ctx.addIssue({ code: "custom", path: ["just"], message: "Justificativa obrigatória quando o recebido supera o previsto." });
  });
export type ReciboFormInput = z.infer<ReturnType<typeof reciboFormSchema>>;

export const novaParcelaFormSchema = z.object({
  competence: z.string().min(1, "Informe a competência."),
  pp: z.string(), pi: z.string(), rp: z.string(), ri: z.string(),
  etapa: z.string(),
  reason: z.string(), action: z.string(), deadline: z.string(), flag: z.string(),
  origin: z.enum(["google_sheets", "crm", "platform", "future_financial_database"]),
  provisional: z.boolean(),
});
export type NovaParcelaFormInput = z.infer<typeof novaParcelaFormSchema>;

export const motivoSchema = z.object({ motivo: z.string().min(1, "Informe o motivo.") });
export type MotivoInput = z.infer<typeof motivoSchema>;
```

Note: `financeiroFormSchema`/`novaParcelaFormSchema` mantêm os campos de moeda (`pp`/`pi`/`rp`/`ri`) como `z.string()` sem validação de formato — igual ao comportamento atual (`parseBRL` nunca lança erro, retorna `0` em entrada inválida; não existe validação de formato de moeda hoje, não é o momento de inventar uma nova regra de negócio). A conversão pra número continua acontecendo no `onSalvar`, exatamente como já é feito.

- [ ] **Passo 3: Atualizar `receivablesActions.ts`** — importar `recibo`(renomeie a variável local pra evitar conflito, ou remova a definição local e use os novos schemas onde fizer sentido). **Atenção:** os schemas `financeiroFormSchema`/`novaParcelaFormSchema`/`reciboFormSchema` acima são schemas do FORMULÁRIO (strings de moeda não convertidas) — as Server Actions (`salvarFinanceiro`, `criarRecebivel`, `registrarRecebimento`) continuam validando com os schemas de SERVIDOR que já existem hoje (`financeiro`, `novoRecebivel`, `recibo`, com `z.number()`), porque a conversão de string→número já aconteceu no cliente antes de chamar a action. **Não mude a validação do lado servidor nesta task** — ela já está correta e não decorre de nenhum bug encontrado. Só remova/ajuste imports se necessário pra evitar nomes duplicados (o arquivo de schemas usa `financeiroFormSchema`, o arquivo de actions continua com sua própria `const financeiro` local — nomes diferentes, sem conflito).

```bash
npm run typecheck
```

Não deve haver nenhuma mudança de comportamento nas Server Actions nesta task — só a criação do arquivo de schemas novo. Se o `receivablesActions.ts` não precisar de nenhuma edição de fato (schemas do formulário ficam só no arquivo novo, sem tocar nos schemas de servidor existentes), tudo bem — commite só o arquivo novo.

- [ ] **Passo 4: Commit**

```bash
git add src/lib/schemas/receivables-admin.ts
git commit -m "feat: cria schemas zod para os formularios de Acoes do Master Admin"
```

(Se `receivablesActions.ts` precisou de alguma edição real no Passo 3, inclua no `git add`.)

---

## Task 2: Migrar o wrapper `Modal` → `Dialog` em `AcoesMaster`

**Files:** Modify: `src/components/cobrancas/acoes-master.tsx`

Troca as 8 instâncias de `<Modal aberto={...} titulo="..." onFechar={fechar} largura="...">` por `<Dialog open={...} onOpenChange={(o) => !o && fechar()}><DialogContent className="sm:max-w-..."><DialogHeader><DialogTitle>...</DialogTitle></DialogHeader>...conteúdo...</DialogContent></Dialog>`. **Não toque no conteúdo interno dos formulários nesta task** — isso é escopo das Tasks 3-9. Só a casca.

- [ ] **Passo 1: Confirmar o arquivo real** (`cat src/components/cobrancas/acoes-master.tsx`)

- [ ] **Passo 2: Trocar o import e as 8 instâncias de `Modal`**

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
```

Mapeamento de largura: sem `largura` explícita no original → `sm:max-w-lg` (default do `Modal` antigo); `largura="max-w-md"` → `sm:max-w-md`.

```tsx
<Dialog open={acao === "cadastro"} onOpenChange={(o) => !o && fechar()}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Editar cadastro do projeto</DialogTitle></DialogHeader><FormCadastro r={r} erro={erro} pending={pending} onSalvar={(d) => exec(() => editarProjeto(r.project_id, d))} /></DialogContent></Dialog>
<Dialog open={acao === "fase"} onOpenChange={(o) => !o && fechar()}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Alterar Fase do projeto</DialogTitle></DialogHeader><FormFase atual={r.stage_code} erro={erro} pending={pending} onSalvar={(f, j) => exec(() => alterarFase(r.project_id, f, j))} /></DialogContent></Dialog>
<Dialog open={acao === "situacao"} onOpenChange={(o) => !o && fechar()}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Alterar Situação do projeto</DialogTitle></DialogHeader><FormSituacao r={r} erro={erro} pending={pending} onSalvar={(s, j, f) => exec(() => alterarSituacao(r.project_id, s, j, f))} /></DialogContent></Dialog>
<Dialog open={acao === "valores"} onOpenChange={(o) => !o && fechar()}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Editar valores</DialogTitle></DialogHeader><FormValores r={r} erro={erro} pending={pending} onSalvar={(d) => exec(() => salvarFinanceiro({ id: r.id, ...d }))} /></DialogContent></Dialog>
<Dialog open={acao === "recebimento"} onOpenChange={(o) => !o && fechar()}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Registrar recebimento</DialogTitle></DialogHeader><FormRecebimento r={r} erro={erro} pending={pending} onSalvar={(d) => exec(() => registrarRecebimento({ id: r.id, ...d }))} /></DialogContent></Dialog>
<Dialog open={acao === "parcela"} onOpenChange={(o) => !o && fechar()}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Nova parcela / recebível</DialogTitle></DialogHeader><FormParcela r={r} etapas={etapas} erro={erro} pending={pending} onSalvar={(d) => exec(() => criarRecebivel({ project_id: r.project_id, ...d }))} /></DialogContent></Dialog>
<Dialog open={acao === "excluir"} onOpenChange={(o) => !o && fechar()}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Excluir da gestão</DialogTitle></DialogHeader><FormMotivo texto={`O projeto "${r.project_name}" e todos os seus recebíveis deixarão de aparecer em dashboards, totais, cobranças e filtros. O histórico é preservado e o projeto pode ser restaurado.`} rotulo="Confirmar exclusão" erro={erro} pending={pending} onSalvar={(m) => exec(() => excluirDaGestao(r.project_id, m))} danger /></DialogContent></Dialog>
<Dialog open={acao === "restaurar"} onOpenChange={(o) => !o && fechar()}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Restaurar projeto</DialogTitle></DialogHeader><p className="text-[13px]">Restaurar &quot;{r.project_name}&quot; e seus recebíveis para a operação ativa?</p><Erro msg={erro} /><div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={fechar}>Cancelar</Button><Button disabled={pending} onClick={() => exec(() => restaurarProjeto(r.project_id))}>Restaurar</Button></div></DialogContent></Dialog>
```

- [ ] **Passo 3: Verificar se `src/components/ui/modal.tsx` ainda é usado em outro lugar**

```bash
grep -rn 'from "@/components/ui/modal"' src
```

Se a única ocorrência restante for dentro de `node_modules` ou nenhuma, delete `src/components/ui/modal.tsx` neste commit (arquivo morto). Se houver outro call-site real, deixe o arquivo — não é escopo desta task remover usos de outros componentes.

- [ ] **Passo 4: Verificar tipos** (`npm run typecheck`)

- [ ] **Passo 5: Teste visual** — abra um recebível em `/cobrancas` (Supabase local + dev server já rodando, login `admin@teste.local`/`Teste@123`), clique em cada um dos 8 botões de ação e confirme que o modal novo (shadcn `Dialog`, centralizado, com overlay) abre com o título certo, mesmo que o conteúdo interno ainda pareça "antigo" (isso é esperado, as Tasks 3-9 cuidam disso). Fechar (X, Cancelar, Esc, clique fora) deve funcionar em todos.

- [ ] **Passo 6: Commit**

```bash
git add src/components/cobrancas/acoes-master.tsx
git rm src/components/ui/modal.tsx  # só se confirmado sem outros usos no Passo 3
git commit -m "feat: migra wrapper Modal para Dialog do shadcn em AcoesMaster"
```

---

## Task 3: Migrar `FormCadastro` (Editar cadastro do projeto)

**Files:** Modify: `src/components/cobrancas/acoes-master.tsx`

```tsx
function FormCadastro({ r, erro, pending, onSalvar }: { r: Receivable; erro: string | null; pending: boolean; onSalvar: (d: EditarProjetoInput) => void }) {
  const form = useForm<EditarProjetoInput>({ resolver: zodResolver(editarProjetoSchema), defaultValues: { name: r.project_name, hub: r.hub, ministry_government: r.ministry_government ?? "", institute: r.institute ?? "", foundation: r.foundation ?? "", origin: r.project_origin, provisional: r.project_provisional, notes: "" } });
  return (
    <form onSubmit={form.handleSubmit(onSalvar)} className="grid grid-cols-2 gap-3">
      <Controller control={form.control} name="name" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error} className="col-span-2"><FieldLabel htmlFor={field.name}>Projeto</FieldLabel><Input id={field.name} aria-invalid={!!fieldState.error} {...field} /><FieldError errors={[fieldState.error]} /></Field>
      )} />
      <Controller control={form.control} name="hub" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>HUB</FieldLabel>
          <Select value={field.value} onValueChange={field.onChange}><SelectTrigger id={field.name} className="w-full" aria-invalid={!!fieldState.error}><SelectValue>{(v: string) => v}</SelectValue></SelectTrigger><SelectContent><SelectItem value="IFES">IFES</SelectItem><SelectItem value="GOV">GOV</SelectItem></SelectContent></Select>
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
          <Select value={field.value} onValueChange={field.onChange}><SelectTrigger id={field.name} className="w-full" aria-invalid={!!fieldState.error}><SelectValue>{(v: keyof typeof ORIGIN_LABEL) => ORIGIN_LABEL[v]}</SelectValue></SelectTrigger><SelectContent>{ORIGENS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
          <FieldError errors={[fieldState.error]} /></Field>
      )} />
      <Controller control={form.control} name="provisional" render={({ field }) => (
        <label className="flex items-center gap-2 self-end pb-2 text-[12px]"><input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />Provisório (CRM / pré-base)</label>
      )} />
      <Controller control={form.control} name="notes" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error} className="col-span-2"><FieldLabel htmlFor={field.name}>Observação</FieldLabel><Textarea id={field.name} aria-invalid={!!fieldState.error} {...field} value={field.value ?? ""} /><FieldError errors={[fieldState.error]} /></Field>
      )} />
      <div className="col-span-2"><Erro msg={erro} /><div className="mt-4 flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button></div></div>
    </form>
  );
}
```

Note: `onSalvar` recebe `EditarProjetoInput` direto (já tem `ministry_government`/`institute`/`foundation`/`notes` como `string | null` — o call-site em `AcoesMaster` (`(d) => exec(() => editarProjeto(r.project_id, d))`) já espera exatamente esse formato, `editarProjeto` já faz `vazio(...)` internamente pra converter string vazia em `null` — então NÃO faça a conversão `f.x || null` no cliente como o código antigo fazia, deixe passar a string (mesmo vazia) direto, o servidor já trata. Confirme lendo `editarProjeto` em `receivablesActions.ts` antes de assumir — se ele não tratar, ajuste o `onSalvar` pra converter, mas o comportamento observável final (campo vazio → grava `null` no banco) tem que ser o mesmo de antes.

- [ ] **Passo 1: Adicionar os imports necessários no topo do arquivo** (react-hook-form, zodResolver, Field/Input/Textarea/Select do shadcn, os schemas de `@/lib/schemas/receivables-admin`) — consolide num único bloco de import no topo do arquivo, reaproveitado por todas as Tasks 3-9 (não repita import por task).

```tsx
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { editarProjetoSchema, type EditarProjetoInput, alterarFaseSchema, type AlterarFaseInput, alterarSituacaoSchema, type AlterarSituacaoInput, financeiroFormSchema, type FinanceiroFormInput, reciboFormSchema, type ReciboFormInput, novaParcelaFormSchema, type NovaParcelaFormInput, motivoSchema, type MotivoInput } from "@/lib/schemas/receivables-admin";
```

(Pode importar tudo de uma vez agora, mesmo que só use `editarProjetoSchema`/`EditarProjetoInput` nesta task — as próximas tasks vão usar o resto. Isso evita ficar re-editando a linha de import em cada task subsequente.)

- [ ] **Passo 2: Substituir a função `FormCadastro`** pelo código acima.

- [ ] **Passo 3: Verificar tipos** (`npm run typecheck`)

- [ ] **Passo 4: Testar manualmente** — abrir "Editar cadastro", limpar o nome (deixar vazio) → erro client-side. Preencher válido, mudar HUB/Origem (confirmar rótulo certo no trigger), salvar → confirma sucesso.

- [ ] **Passo 5: Commit**

```bash
git add src/components/cobrancas/acoes-master.tsx
git commit -m "feat: migra FormCadastro (Acoes Master) para shadcn + react-hook-form"
```

---

## Task 4: Migrar `FormFase` (Alterar Fase)

**Files:** Modify: `src/components/cobrancas/acoes-master.tsx`

```tsx
function FormFase({ atual, erro, pending, onSalvar }: { atual: string | null; erro: string | null; pending: boolean; onSalvar: (f: string, j: string | null) => void }) {
  const form = useForm<AlterarFaseInput>({ resolver: zodResolver(alterarFaseSchema), defaultValues: { stage_code: (atual ?? "A") as AlterarFaseInput["stage_code"], justification: "" } });
  const onValid = (d: AlterarFaseInput) => onSalvar(d.stage_code, d.justification || null);
  return (
    <form onSubmit={form.handleSubmit(onValid)} className="space-y-3">
      <p className="text-[12px] text-ink-muted">Fase atual: <b>{atual ?? "Pendente"}</b>. Não há exigência de progressão linear; a alteração é auditada.</p>
      <Controller control={form.control} name="stage_code" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Nova fase</FieldLabel>
          <Select value={field.value} onValueChange={field.onChange}><SelectTrigger id={field.name} className="w-full" aria-invalid={!!fieldState.error}><SelectValue>{(v: string) => v}</SelectValue></SelectTrigger><SelectContent>{["A", "B", "C", "D"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
          <FieldError errors={[fieldState.error]} /></Field>
      )} />
      <Controller control={form.control} name="justification" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Justificativa (opcional)</FieldLabel><Textarea id={field.name} aria-invalid={!!fieldState.error} {...field} value={field.value ?? ""} /><FieldError errors={[fieldState.error]} /></Field>
      )} />
      <Erro msg={erro} /><div className="mt-4 flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button></div>
    </form>
  );
}
```

- [ ] **Passo 1: Substituir a função `FormFase`** pelo código acima (imports já feitos na Task 3).

- [ ] **Passo 2: Verificar tipos** (`npm run typecheck`)

- [ ] **Passo 3: Testar manualmente** — abrir "Alterar Fase" num recebível, mudar a fase, salvar → confirma sucesso, fase atualizada na tabela/drawer.

- [ ] **Passo 4: Commit**

```bash
git add src/components/cobrancas/acoes-master.tsx
git commit -m "feat: migra FormFase (Acoes Master) para shadcn + react-hook-form"
```

---

## Task 5: Migrar `FormSituacao` (Alterar Situação — com validação condicional)

**Files:** Modify: `src/components/cobrancas/acoes-master.tsx`

Esta é uma das 2 tasks com regra de validação real: reativar um projeto "Perdido" pra "Ativo" exige fase + justificativa.

```tsx
function FormSituacao({ r, erro, pending, onSalvar }: { r: Receivable; erro: string | null; pending: boolean; onSalvar: (s: "active" | "backlog" | "lost", j: string | null, f: string | null) => void }) {
  const statusOriginal = r.project_status === "archived" ? "active" : r.project_status;
  const schema = alterarSituacaoSchema(r.project_status);
  const form = useForm<AlterarSituacaoInput>({ resolver: zodResolver(schema), defaultValues: { status: statusOriginal, justification: "", stage_code: r.stage_code ?? "" } });
  const status = form.watch("status");
  const reativandoPerdido = r.project_status === "lost" && status === "active";
  const onValid = (d: AlterarSituacaoInput) => onSalvar(d.status, d.justification || null, d.stage_code || null);
  return (
    <form onSubmit={form.handleSubmit(onValid)} className="space-y-3">
      <Controller control={form.control} name="status" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Situação</FieldLabel>
          <Select value={field.value} onValueChange={field.onChange}><SelectTrigger id={field.name} className="w-full" aria-invalid={!!fieldState.error}><SelectValue>{(v: "active" | "backlog" | "lost") => ({ active: "Ativo", backlog: "Backlog", lost: "Perdido" }[v])}</SelectValue></SelectTrigger><SelectContent><SelectItem value="active">Ativo</SelectItem><SelectItem value="backlog">Backlog</SelectItem><SelectItem value="lost">Perdido</SelectItem></SelectContent></Select>
          <FieldError errors={[fieldState.error]} /></Field>
      )} />
      {reativandoPerdido && <Controller control={form.control} name="stage_code" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Confirmar fase (obrigatório ao reativar um perdido)</FieldLabel>
          <Select value={field.value || "__nenhuma__"} onValueChange={(v) => field.onChange(v === "__nenhuma__" ? "" : v)}><SelectTrigger id={field.name} className="w-full" aria-invalid={!!fieldState.error}><SelectValue>{(v: string) => (v === "__nenhuma__" ? "—" : v)}</SelectValue></SelectTrigger><SelectContent><SelectItem value="__nenhuma__">—</SelectItem>{["A", "B", "C", "D"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
          <FieldError errors={[fieldState.error]} /></Field>
      )} />}
      <Controller control={form.control} name="justification" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>{reativandoPerdido ? "Justificativa (obrigatória)" : "Justificativa"}</FieldLabel><Textarea id={field.name} aria-invalid={!!fieldState.error} {...field} value={field.value ?? ""} /><FieldError errors={[fieldState.error]} /></Field>
      )} />
      <p className="text-[11px] text-ink-faint">A fase é preservada; Backlog e Perdido saem dos totais ativos, mas continuam consultáveis.</p>
      <Erro msg={erro} /><div className="mt-4 flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button></div>
    </form>
  );
}
```

Note: `form.watch("status")` reage em tempo real pra mostrar/esconder o campo "Confirmar fase" — mesmo comportamento reativo que o `useState` original tinha. O `Select` de "Confirmar fase" usa seu próprio valor-sentinela (`__nenhuma__`) igual ao padrão já usado em outros lugares, já que o campo pode estar vazio.

- [ ] **Passo 1: Substituir a função `FormSituacao`** pelo código acima.

- [ ] **Passo 2: Verificar tipos** (`npm run typecheck`)

- [ ] **Passo 3: Testar manualmente — os 2 cenários que importam:**
  1. Recebível com projeto "Ativo": mudar pra "Backlog", justificativa opcional, salvar → sucesso sem exigir nada extra.
  2. Recebível com projeto "Perdido" (se não houver um de teste, pode criar um via "Alterar Situação" → "Perdido" primeiro): reabrir "Alterar Situação", mudar de "Perdido" pra "Ativo" → confirme que o campo "Confirmar fase" aparece E que submeter sem preencher fase/justificativa mostra os 2 erros client-side ("Selecione a fase para reativar.", "Justificativa obrigatória ao reativar um perdido."). Preencher os 2 → salva com sucesso.

- [ ] **Passo 4: Commit**

```bash
git add src/components/cobrancas/acoes-master.tsx
git commit -m "feat: migra FormSituacao (Acoes Master) para shadcn, com validacao condicional de reativacao"
```

---

## Task 6: Migrar `FormValores` (Editar valores)

**Files:** Modify: `src/components/cobrancas/acoes-master.tsx`

```tsx
function FormValores({ r, erro, pending, onSalvar }: { r: Receivable; erro: string | null; pending: boolean; onSalvar: (d: { planned_project: number; planned_innovatis: number; received_project: number; received_innovatis: number; competence: string; flag: string | null; origin: Receivable["origin"]; provisional: boolean; legacy_consolidated: boolean; justification: string | null }) => void }) {
  const s = (n: number | string) => Number(n).toFixed(2).replace(".", ",");
  const form = useForm<FinanceiroFormInput>({ resolver: zodResolver(financeiroFormSchema), defaultValues: { pp: s(r.planned_project), pi: s(r.planned_innovatis), rp: s(r.received_project), ri: s(r.received_innovatis), competence: r.competence, flag: r.flag ?? "", origin: r.origin, provisional: r.provisional, legacy_consolidated: r.legacy_consolidated, justification: "" } });
  const onValid = (f: FinanceiroFormInput) => onSalvar({ planned_project: parseBRL(f.pp), planned_innovatis: parseBRL(f.pi), received_project: parseBRL(f.rp), received_innovatis: parseBRL(f.ri), competence: f.competence.slice(0, 8) + "01", flag: f.flag || null, origin: f.origin, provisional: f.provisional, legacy_consolidated: f.legacy_consolidated, justification: f.justification || null });
  const CampoNum = ({ name, label }: { name: "pp" | "pi" | "rp" | "ri"; label: string }) => (
    <Controller control={form.control} name={name} render={({ field, fieldState }) => (
      <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>{label}</FieldLabel><Input id={field.name} className="text-right" aria-invalid={!!fieldState.error} {...field} /><FieldError errors={[fieldState.error]} /></Field>
    )} />
  );
  return (
    <form onSubmit={form.handleSubmit(onValid)} className="grid grid-cols-2 gap-3">
      <CampoNum name="pp" label="Previsto Projeto" /><CampoNum name="pi" label="Previsto Innovatis" />
      <CampoNum name="rp" label="Recebido Projeto" /><CampoNum name="ri" label="Recebido Innovatis" />
      <Controller control={form.control} name="competence" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Competência (1º dia do mês)</FieldLabel><Input id={field.name} type="date" aria-invalid={!!fieldState.error} {...field} /><FieldError errors={[fieldState.error]} /></Field>
      )} />
      <Controller control={form.control} name="flag" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>FLAG</FieldLabel><Input id={field.name} aria-invalid={!!fieldState.error} {...field} value={field.value ?? ""} /><FieldError errors={[fieldState.error]} /></Field>
      )} />
      <Controller control={form.control} name="origin" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Origem</FieldLabel>
          <Select value={field.value} onValueChange={field.onChange}><SelectTrigger id={field.name} className="w-full" aria-invalid={!!fieldState.error}><SelectValue>{(v: keyof typeof ORIGIN_LABEL) => ORIGIN_LABEL[v]}</SelectValue></SelectTrigger><SelectContent>{ORIGENS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
          <FieldError errors={[fieldState.error]} /></Field>
      )} />
      <div className="flex flex-col gap-1 self-end pb-1 text-[12px]">
        <Controller control={form.control} name="provisional" render={({ field }) => <label className="flex items-center gap-2"><input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />Provisório</label>} />
        <Controller control={form.control} name="legacy_consolidated" render={({ field }) => <label className="flex items-center gap-2"><input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />Consolidado (vencidos até jun/2026)</label>} />
      </div>
      <Controller control={form.control} name="justification" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error} className="col-span-2"><FieldLabel htmlFor={field.name}>Justificativa</FieldLabel><Textarea id={field.name} aria-invalid={!!fieldState.error} {...field} value={field.value ?? ""} /><FieldError errors={[fieldState.error]} /></Field>
      )} />
      <div className="col-span-2"><Erro msg={erro} /><div className="mt-4 flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button></div></div>
    </form>
  );
}
```

Lembre de importar `parseBRL`/`fmtBRL` de `@/lib/format` no topo do arquivo (já devem estar importados, confirme).

- [ ] **Passo 1: Substituir a função `FormValores`** pelo código acima.

- [ ] **Passo 2: Verificar tipos** (`npm run typecheck`)

- [ ] **Passo 3: Testar manualmente** — abrir "Editar valores", mudar "Recebido Projeto" pra um valor tipo `1.500,00`, salvar → confirmar que o valor é persistido corretamente (não vira `1.5` nem `150000`).

- [ ] **Passo 4: Commit**

```bash
git add src/components/cobrancas/acoes-master.tsx
git commit -m "feat: migra FormValores (Acoes Master) para shadcn + react-hook-form"
```

---

## Task 7: Migrar `FormRecebimento` (Registrar recebimento — com validação condicional)

**Files:** Modify: `src/components/cobrancas/acoes-master.tsx`

Segunda das 2 tasks com validação condicional real: recebido > previsto exige confirmação + justificativa.

```tsx
function FormRecebimento({ r, erro, pending, onSalvar }: { r: Receivable; erro: string | null; pending: boolean; onSalvar: (d: { received_project: number; received_innovatis: number; received_date: string | null; invoice_number: string | null; note: string | null; justification: string | null }) => void }) {
  const plannedProject = Number(r.planned_project), plannedInnovatis = Number(r.planned_innovatis);
  const schema = reciboFormSchema(plannedProject, plannedInnovatis);
  const form = useForm<ReciboFormInput>({ resolver: zodResolver(schema), defaultValues: { rp: Number(r.received_project).toFixed(2).replace(".", ","), ri: Number(r.received_innovatis).toFixed(2).replace(".", ","), data: "", nf: "", note: "", just: "", confirmar: false } });
  const [rpStr, riStr] = form.watch(["rp", "ri"]);
  const rp = parseBRL(rpStr), ri = parseBRL(riStr);
  const excede = rp > plannedProject + 0.01 || ri > plannedInnovatis + 0.01;
  const saldoAntes = Number(r.balance_project) + Number(r.balance_innovatis);
  const saldoDepois = Math.max(plannedProject - rp, 0) + Math.max(plannedInnovatis - ri, 0);
  const onValid = (f: ReciboFormInput) => onSalvar({ received_project: parseBRL(f.rp), received_innovatis: parseBRL(f.ri), received_date: f.data || null, invoice_number: f.nf || null, note: f.note || null, justification: f.just || null });
  return (
    <form onSubmit={form.handleSubmit(onValid)} className="space-y-3">
      <p className="text-[12px] text-ink-muted">Informe o valor <b>acumulado</b> recebido em cada perspectiva.</p>
      <div className="grid grid-cols-2 gap-3">
        <Controller control={form.control} name="rp" render={({ field, fieldState }) => (
          <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>{`Recebido Projeto (previsto ${fmtBRL(plannedProject)})`}</FieldLabel><Input id={field.name} className="text-right" aria-invalid={!!fieldState.error} {...field} /><FieldError errors={[fieldState.error]} /></Field>
        )} />
        <Controller control={form.control} name="ri" render={({ field, fieldState }) => (
          <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>{`Recebido Innovatis (previsto ${fmtBRL(plannedInnovatis)})`}</FieldLabel><Input id={field.name} className="text-right" aria-invalid={!!fieldState.error} {...field} /><FieldError errors={[fieldState.error]} /></Field>
        )} />
        <Controller control={form.control} name="data" render={({ field, fieldState }) => (
          <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Data do recebimento</FieldLabel><Input id={field.name} type="date" aria-invalid={!!fieldState.error} {...field} /><FieldError errors={[fieldState.error]} /></Field>
        )} />
        <Controller control={form.control} name="nf" render={({ field, fieldState }) => (
          <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>NF</FieldLabel><Input id={field.name} aria-invalid={!!fieldState.error} {...field} /><FieldError errors={[fieldState.error]} /></Field>
        )} />
      </div>
      <div className="grid grid-cols-3 gap-2 rounded border border-line bg-canvas p-2 text-[12px]"><div>Saldo antes<div className="num font-semibold">{fmtBRL(saldoAntes)}</div></div><div>Valor recebido (total)<div className="num font-semibold text-ok">{fmtBRL(rp + ri)}</div></div><div>Saldo depois<div className="num font-semibold">{fmtBRL(saldoDepois)}</div></div></div>
      {excede && <div className="rounded border border-warn/40 bg-warn-soft p-2 text-[12px] text-warn"><b>Atenção:</b> o recebido supera o previsto. O saldo não fica negativo; a inconsistência será sinalizada. Para continuar, justifique e confirme.
        <Controller control={form.control} name="confirmar" render={({ field, fieldState }) => (
          <div className="mt-1"><label className="flex items-center gap-2"><input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />Confirmo que o valor está correto</label><FieldError errors={[fieldState.error]} /></div>
        )} />
      </div>}
      <Controller control={form.control} name="note" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Observação</FieldLabel><Input id={field.name} aria-invalid={!!fieldState.error} {...field} /><FieldError errors={[fieldState.error]} /></Field>
      )} />
      <Controller control={form.control} name="just" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>{excede ? "Justificativa (obrigatória)" : "Justificativa (se correção)"}</FieldLabel><Textarea id={field.name} aria-invalid={!!fieldState.error} {...field} /><FieldError errors={[fieldState.error]} /></Field>
      )} />
      <Erro msg={erro} /><div className="mt-4 flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Registrar"}</Button></div>
    </form>
  );
}
```

Note: o botão de submit não precisa mais do `disabled={pending || (excede && !f.confirmar)}` manual — o `zodResolver` com `reciboFormSchema` já bloqueia o submit via validação (o `handleSubmit` do react-hook-form não chama `onValid` se a validação falhar). O `form.watch(["rp", "ri"])` mantém o cálculo de `excede`/saldo reativo em tempo real, igual ao `useState` original.

- [ ] **Passo 1: Substituir a função `FormRecebimento`** pelo código acima.

- [ ] **Passo 2: Verificar tipos** (`npm run typecheck`)

- [ ] **Passo 3: Testar manualmente — os 2 cenários que importam:**
  1. Recebimento normal (dentro do previsto): preencher e salvar → sucesso direto, sem aviso.
  2. Recebimento que supera o previsto: informar um valor maior que o previsto → aviso amarelo aparece com o checkbox; tentar salvar sem marcar o checkbox/preencher justificativa → erro client-side nos 2 campos; marcar+justificar → salva com sucesso.

- [ ] **Passo 4: Commit**

```bash
git add src/components/cobrancas/acoes-master.tsx
git commit -m "feat: migra FormRecebimento (Acoes Master) para shadcn, com validacao condicional de excedente"
```

---

## Task 8: Migrar `FormParcela` (Nova parcela / recebível)

**Files:** Modify: `src/components/cobrancas/acoes-master.tsx`

```tsx
function FormParcela({ r, etapas, erro, pending, onSalvar }: { r: Receivable; etapas: CollectionStatus[]; erro: string | null; pending: boolean; onSalvar: (d: Omit<Parameters<typeof criarRecebivel>[0], "project_id">) => void }) {
  const opcoesHub = etapas.filter((e) => e.hub === r.hub);
  const form = useForm<NovaParcelaFormInput>({ resolver: zodResolver(novaParcelaFormSchema), defaultValues: { competence: "", pp: "", pi: "", rp: "0", ri: "0", etapa: "", reason: "", action: "", deadline: "", flag: "", origin: "platform", provisional: r.project_provisional } });
  const onValid = (f: NovaParcelaFormInput) => onSalvar({ competence: `${f.competence}-01`, planned_project: parseBRL(f.pp), planned_innovatis: parseBRL(f.pi), received_project: parseBRL(f.rp), received_innovatis: parseBRL(f.ri), collection_status_id: f.etapa || null, reason: f.reason || null, action: f.action || null, responsible_user_id: null, responsible_legacy_name: null, operational_deadline: f.deadline || null, flag: f.flag || null, origin: f.origin, provisional: f.provisional });
  const CampoNum = ({ name, label }: { name: "pp" | "pi" | "rp" | "ri"; label: string }) => (
    <Controller control={form.control} name={name} render={({ field, fieldState }) => (
      <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>{label}</FieldLabel><Input id={field.name} className="text-right" aria-invalid={!!fieldState.error} {...field} /><FieldError errors={[fieldState.error]} /></Field>
    )} />
  );
  return (
    <form onSubmit={form.handleSubmit(onValid)} className="grid grid-cols-2 gap-3">
      <p className="col-span-2 text-[12px] text-ink-muted">Projeto: <b>{r.project_name}</b></p>
      <Controller control={form.control} name="competence" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Competência</FieldLabel><Input id={field.name} type="month" aria-invalid={!!fieldState.error} {...field} /><FieldError errors={[fieldState.error]} /></Field>
      )} />
      <Controller control={form.control} name="etapa" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Etapa da cobrança</FieldLabel>
          <Select value={field.value || "__nenhuma__"} onValueChange={(v) => field.onChange(v === "__nenhuma__" ? "" : v)}><SelectTrigger id={field.name} className="w-full" aria-invalid={!!fieldState.error}><SelectValue>{(v: string) => (v === "__nenhuma__" ? "—" : opcoesHub.find((e) => e.id === v)?.display_label ?? v)}</SelectValue></SelectTrigger><SelectContent><SelectItem value="__nenhuma__">—</SelectItem>{opcoesHub.map((e) => <SelectItem key={e.id} value={e.id}>{e.display_label}</SelectItem>)}</SelectContent></Select>
          <FieldError errors={[fieldState.error]} /></Field>
      )} />
      <CampoNum name="pp" label="Previsto Projeto" /><CampoNum name="pi" label="Previsto Innovatis" /><CampoNum name="rp" label="Recebido Projeto" /><CampoNum name="ri" label="Recebido Innovatis" />
      <Controller control={form.control} name="reason" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Motivo</FieldLabel><Input id={field.name} aria-invalid={!!fieldState.error} {...field} /><FieldError errors={[fieldState.error]} /></Field>
      )} />
      <Controller control={form.control} name="action" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Ação</FieldLabel><Input id={field.name} aria-invalid={!!fieldState.error} {...field} /><FieldError errors={[fieldState.error]} /></Field>
      )} />
      <Controller control={form.control} name="deadline" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Prazo</FieldLabel><Input id={field.name} type="date" aria-invalid={!!fieldState.error} {...field} /><FieldError errors={[fieldState.error]} /></Field>
      )} />
      <Controller control={form.control} name="flag" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>FLAG</FieldLabel><Input id={field.name} aria-invalid={!!fieldState.error} {...field} /><FieldError errors={[fieldState.error]} /></Field>
      )} />
      <Controller control={form.control} name="origin" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Origem</FieldLabel>
          <Select value={field.value} onValueChange={field.onChange}><SelectTrigger id={field.name} className="w-full" aria-invalid={!!fieldState.error}><SelectValue>{(v: keyof typeof ORIGIN_LABEL) => ORIGIN_LABEL[v]}</SelectValue></SelectTrigger><SelectContent>{ORIGENS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
          <FieldError errors={[fieldState.error]} /></Field>
      )} />
      <Controller control={form.control} name="provisional" render={({ field }) => (
        <label className="flex items-center gap-2 self-end pb-2 text-[12px]"><input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />Provisório</label>
      )} />
      <div className="col-span-2"><Erro msg={erro} /><div className="mt-4 flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Criando…" : "Criar"}</Button></div></div>
    </form>
  );
}
```

- [ ] **Passo 1: Substituir a função `FormParcela`** pelo código acima.

- [ ] **Passo 2: Verificar tipos** (`npm run typecheck`)

- [ ] **Passo 3: Testar manualmente** — abrir "Criar nova parcela", preencher competência + valores, escolher uma etapa (confirmar rótulo certo), criar → confirma sucesso, nova parcela aparece na tabela/drawer.

- [ ] **Passo 4: Commit**

```bash
git add src/components/cobrancas/acoes-master.tsx
git commit -m "feat: migra FormParcela (Acoes Master) para shadcn + react-hook-form"
```

---

## Task 9: Migrar `FormMotivo` e corrigir variantes de `Button` (`danger`→`destructive`, `primary`→`default`)

**Files:** Modify: `src/components/cobrancas/acoes-master.tsx`

Última peça de conteúdo (usada 2x: "Excluir da gestão" e, no futuro, poderia ser reusada — mas hoje só ali) + a correção dos 2 erros de tipo que apareceram desde a Task 2 da fundação shadcn (`variant="danger"` no botão "Excluir da gestão" da barra principal, `variant={danger ? "danger" : "primary"}` no `Rodape`).

```tsx
function FormMotivo({ texto, rotulo, erro, pending, onSalvar, danger }: { texto: string; rotulo: string; erro: string | null; pending: boolean; onSalvar: (m: string) => void; danger?: boolean }) {
  const form = useForm<MotivoInput>({ resolver: zodResolver(motivoSchema), defaultValues: { motivo: "" } });
  const onValid = (d: MotivoInput) => onSalvar(d.motivo);
  return (
    <form onSubmit={form.handleSubmit(onValid)} className="space-y-3">
      <p className="text-[13px]">{texto}</p>
      <Controller control={form.control} name="motivo" render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error}><FieldLabel htmlFor={field.name}>Motivo (obrigatório)</FieldLabel><Textarea id={field.name} className="h-16" aria-invalid={!!fieldState.error} {...field} /><FieldError errors={[fieldState.error]} /></Field>
      )} />
      <Erro msg={erro} /><div className="mt-4 flex justify-end"><Button type="submit" variant={danger ? "destructive" : "default"} disabled={pending}>{pending ? "Salvando…" : rotulo}</Button></div>
    </form>
  );
}
```

E o `Rodape` (usado pelas outras 6 tasks — **atenção, essa função já não é mais usada depois das Tasks 3-8**, que passaram a inlinear seu próprio rodapé com `<Button type="submit">` direto dentro de cada `<form>`; confirme com `grep -n "<Rodape" src/components/cobrancas/acoes-master.tsx` — se não houver mais nenhum uso, **delete a função `Rodape`** neste commit, código morto).

E na barra principal de botões (dentro de `AcoesMaster`):

```tsx
<Button size="sm" variant="destructive" onClick={() => setAcao("excluir")}>Excluir da gestão</Button>
```

(troca só esse 1 `variant="danger"` → `"destructive"`, os outros botões da barra já usam `variant="outline"`/`"ghost"`, que já são válidos.)

- [ ] **Passo 1: Substituir `FormMotivo`, remover `Rodape` (se confirmado sem uso) e corrigir o `variant` do botão "Excluir da gestão".**

- [ ] **Passo 2: Verificar tipos — este é o momento em que o projeto INTEIRO deve ficar sem nenhum erro**

```bash
npm run typecheck
```

Deve retornar **zero erros**, em qualquer arquivo do projeto.

- [ ] **Passo 3: Testar manualmente** — "Excluir da gestão": tentar salvar sem motivo → erro client-side; preencher e confirmar → projeto arquivado (desaparece da lista ativa). Se houver um projeto arquivado de teste, testar "Restaurar" também (esse modal não usa `FormMotivo`, já está migrado na Task 2).

- [ ] **Passo 4: Commit**

```bash
git add src/components/cobrancas/acoes-master.tsx
git commit -m "feat: migra FormMotivo e corrige variantes de Button (Acoes Master)"
```

---

## Task 10: Verificação final — todo o projeto deve estar 100% verde

**Files:** nenhum (task de verificação)

- [ ] **Passo 1: Rodar a suite completa**

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

**Todos os 4 devem passar sem nenhum erro.** Esta é a primeira vez desde o início da migração visual completa que `npm run build` deve compilar com sucesso de ponta a ponta (antes, sempre faltava pelo menos `acoes-master.tsx`).

- [ ] **Passo 2: Teste manual completo de ponta a ponta** — percorrer TODAS as telas migradas nesta iniciativa: Login, Alterar Senha, Layout (Sidebar/Topbar em todas as páginas), Auditoria (4 abas + formulários de usuários), Visão Geral (cards, filtros, gráficos, tabelas), Cobranças (filtros, tabela, drawer, novo projeto, formulário operacional) e os 8 modais de Ações do Master Admin. Confirmar visual consistente (shadcn neutro) em tudo, nenhum resíduo do visual "navy institucional" antigo, nenhum erro de console.

- [ ] **Passo 3: Relatar** o resultado final ao usuário: build 100% limpo, pronto para os passos finais (revisão de branch e decisão sobre abrir o PR).

Não abrir o PR nesta task — isso é uma decisão que o usuário quer ser avisado antes (`superpowers:finishing-a-development-branch`).
