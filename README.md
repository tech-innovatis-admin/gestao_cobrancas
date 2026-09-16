# INNOVATIS | Gestão de Cobranças — V0

Sistema interno de gestão de recebíveis dos HUBs IFES e GOV. Substitui a navegação pelas abas mensais da planilha por uma base operacional no Supabase, com autenticação, três perfis, auditoria imutável e integração bidirecional com o Google Sheets via Edge Functions.

**Estado desta entrega:**
- **FASE 1** (Supabase: schema, RLS, RPCs) — implementada.
- **FASE 2** (frontend: Visão Geral, Cobranças, Auditoria) — implementada.
- **FASE 3** (Google Sheets) — implementada por completo: carga inicial, importação, sincronização em ambas as direções (write-back da plataforma para a planilha e leitura de edições externas), resolução de conflitos, fila com reprocessamento, agendamento automático via `pg_cron` e reconciliação de totais contra a aba Dashboard.
- **FASE 4** (qualidade/testes/refino) — parcial: view `v_data_quality_issues` (com ação de resolução de conflito integrada na UI) e testes unitários de formatação. Sem escopo fechado além disso.

## 1. Arquitetura

```
Google Sheets ⇄ Sheets API v4 ⇄ Supabase Edge Functions ⇄ Supabase Postgres ⇄ Next.js (App Router)
```

- O frontend nunca consulta o Google Sheets diretamente. Leituras vêm de `v_receivables_enriched` no Postgres; escritas na planilha acontecem só via Edge Functions, nunca no cliente.
- Leitura em Server Components (`src/services/*Service.ts`); mutações em Server Actions (`*Actions.ts`, incluindo `syncActions.ts`) que chamam RPCs `rpc_*` com `assert_role` — o servidor revalida a permissão sempre, mesmo que a RLS já restrinja o acesso.
- Camada de abstração da fonte: `src/integrations/receivables-source/` com o contrato `ReceivablesSourceAdapter` (`healthCheck`, `initialize`, `previewImport`, `importData`, `synchronize`, `updateOperationalFields`, `updateFinancialFields`, `retryQueue`, `resolveConflict`), implementado por `GoogleSheetsLegacyAdapter` (V0, ativo) e `FinancialDatabaseAdapter` (futuro, stub não funcional). Componentes React não conhecem abas, linhas ou células — só o formato tipado do contrato.
- Três clients Supabase: browser, server (cookies) e admin (`service_role`, `server-only`).
- Escrita plataforma → planilha é **assíncrona**: a RPC que aplica a mudança no Postgres também enfileira o write-back em `sync_queue`; um job `pg_cron` (`process-sync-queue`, a cada 5 min) drena a fila e escreve na planilha real. Não é instantâneo por design — o botão "Tentar novamente" na Auditoria força o processamento imediato quando necessário.

## 2. Modelo de dados

Quatro conceitos separados: **fase** (A/B/C/D, `project_stage_catalog`), **situação do projeto** (`active|backlog|lost|archived`), **etapa da cobrança** (`collection_status_catalog`) e **situação financeira** (calculada na view: Não aplicável / Aberto / Parcial / Pago, por Projeto, Innovatis e Geral). Origem (`google_sheets|crm|platform|future_financial_database`) e `provisional` são independentes da fase.

Um recebível = duas linhas da planilha (previsto + recebido) = **uma** linha em `receivables`, com `id = ID_COBRANCA` (a mesma UUID gravada nas duas linhas da planilha). Competência sempre no dia 1. Saldo = `greatest(previsto − recebido, 0)`; recebido > previsto gera alerta em `v_data_quality_issues`, nunca saldo negativo. Atraso na V0 = competência < atual ∧ saldo > 0,01 ∧ projeto ativo — o prazo operacional não entra nesse cálculo.

Controle de concorrência: `source_version` em `receivables`, incrementado a cada escrita (local ou externa); `sync_status` (`synchronized|pending|conflict|error`) indica o estado da sincronização com a planilha.

## 3. Tabelas

| Tabela | Papel |
|---|---|
| `profiles` | usuário, perfil (`viewer\|operator\|master_admin`), `must_change_password`, `last_login_at` |
| `project_stage_catalog` | fases A–D (descrição, ordem, cor) |
| `collection_status_catalog` | etapas de cobrança por HUB, flags `is_paid/is_partially_paid/is_not_applicable`, SLA |
| `sheet_competence_map` | aba mensal ↔ mês/ano (confirmado pelo Master Admin no setup) |
| `legacy_code_mapping` | códigos fora de A–D/BACKLOG/PERDIDO (ex.: F) → fase, situação ou ignorar |
| `projects` | cadastro, fase, situação, origem, provisoriedade, soft delete |
| `receivables` | valores, campos operacionais, `source_*`, `source_version`, `sync_status`, soft delete |
| `audit_logs` | imutável (UPDATE/DELETE bloqueados por trigger); before/after JSONB |
| `sync_runs` | log de cada execução de carga inicial, importação, sincronização e reconciliação |
| `sync_queue` | fila de write-back (`writeback_operational`/`writeback_financial`), com `status`, `attempts`, `last_error` |

Views: `v_projects_enriched`, `v_receivables_enriched` (saldos, situações financeiras, `is_overdue`, `deadline_overdue`, `search_text` sem acentos), `v_data_quality_issues`. Migrations em `supabase/migrations/0001…0004` (ver seção 5).

## 4. Permissões

| | Viewer | Operator | Master Admin |
|---|---|---|---|
| Visão Geral, Cobranças, filtros, exportar | ✓ | ✓ | ✓ |
| Etapa, Responsável, Prazo, Motivo, Ação | — | ✓ (via `rpc_update_receivable_operational`) | ✓ |
| Projeto, fase, situação, valores, recebimentos, competência, origem | — | — | ✓ |
| Usuários, sincronização, conflitos, Auditoria | — | — | ✓ |

Anon: nenhum acesso. Ninguém faz UPDATE direto em `projects`/`receivables` — só RPCs `security definer`. O último Master Admin ativo não pode ser desativado (trigger). Versionamento otimista: as RPCs recebem `expected_version` e rejeitam se `source_version` mudou. As duas RPCs de sincronização de sistema (`rpc_apply_external_sync`) só são executáveis pelo client `service_role` das Edge Functions — nunca por `authenticated`/`anon`.

## 5. Rodando o projeto do zero (checklist para um colaborador novo)

### 5.1 Clonar e instalar
```
git clone <repo>
cd gestao_cobrancas
npm install
```

### 5.2 Criar o projeto Supabase (recomendado: um projeto de dev separado do de produção)
1. Crie o projeto em supabase.com/dashboard.
2. **Authentication → Providers → Email**: desligue *Enable sign ups* e *Confirm email* (usuários só são criados pelo Master Admin).

### 5.3 Aplicar as migrations, em ordem
Via SQL Editor (colar e rodar cada arquivo) ou via CLI já linkada ao projeto (`npx supabase link --project-ref <ref>` com `SUPABASE_ACCESS_TOKEN` configurado, depois `npx supabase db push`):
```
0001_schema.sql
0002_views_rpc.sql
0003_rls_seed.sql
0004_phase3_sync_writeback.sql
```
A `0004` inclui a fila de write-back financeiro, a RPC de sincronização externa e o agendamento via `pg_cron`/`pg_net` — sem ela a FASE 3 não funciona por completo.

### 5.4 Configurar o `.env.local` do Next.js
Copie `.env.example` → `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API).

### 5.5 Criar o Master Admin
**Authentication → Users → Add user**: e-mail, senha temporária, *Auto Confirm* e, em User Metadata:
```json
{ "full_name": "Nome", "role": "master_admin", "must_change_password": true }
```
O trigger `handle_new_user` cria o `profile`. No primeiro login a plataforma redireciona para `/alterar-senha`.

### 5.6 Google Service Account e compartilhamento da planilha
1. Google Cloud Console → APIs & Services → ative **Google Sheets API** → Credentials → Service Account → gere uma chave JSON. O JSON nunca entra no repositório nem em variável `NEXT_PUBLIC_*`.
2. Compartilhe a planilha (a de dev, se for ambiente de desenvolvimento) com o `client_email` da service account como **Editor** — necessário tanto para leitura quanto para o write-back e a criação da coluna `ID_COBRANCA`.

### 5.7 Cadastrar os secrets das Edge Functions e fazer o deploy
Secrets do Google **não vão no `.env.local`** — são secrets do Supabase:
```
npx supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON="$(cat service-account.json)"
npx supabase secrets set GOOGLE_SPREADSHEET_ID=<id da URL da planilha>
npx supabase functions deploy
```
Isso publica as 10 Edge Functions: `google-sheets-health-check`, `preview-google-sheets-import`, `initialize-google-sheets`, `import-google-sheets`, `synchronize-google-sheets`, `update-receivable-operational`, `update-receivable-financial`, `process-sync-queue`, `resolve-sync-conflict`, `reconcile-google-sheets`. Até isso ser feito, a aba **Auditoria → Sincronizações** mostra "Configuração pendente". Teste com `google-sheets-health-check` (lista as abas encontradas).

### 5.8 Habilitar o agendamento automático (Vault + pg_cron)
A migration `0004` já cria os dois jobs `pg_cron`, mas eles só funcionam depois que os secrets abaixo existem no Supabase Vault (nunca em texto claro em migration ou no repo). No SQL Editor, **depois do deploy das functions**:
```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<service_role_key>', 'service_role_key');
```
Confirme que os jobs estão ativos:
```sql
select jobname, schedule, active from cron.job;
-- esperado: process-sync-queue-every-5min (*/5 * * * *) e synchronize-google-sheets-every-30min (*/30 * * * *)
```
Sem esses dois secrets, os jobs rodam a cada execução mas falham silenciosamente (URL nula no `net.http_post`) até serem cadastrados.

### 5.9 Subir o app
```
npm run dev
```
Login como Master Admin → trocar a senha → **Auditoria → Sincronizações**.

### 5.10 Carregar os dados da planilha pela primeira vez
1. Configure `sheet_competence_map` com o mês/ano de cada aba mensal ativa (tabela no Supabase; sem UI dedicada ainda).
2. Em Auditoria → Sincronizações, rode **"Executar carga inicial"**: primeiro mostra um preview (recebíveis encontrados, IDs presentes/ausentes/duplicados, fases encontradas); só grava na planilha (coluna técnica `ID_COBRANCA`) e importa para o Postgres após confirmação explícita.
3. A partir daí, o dia a dia usa: **"Sincronizar agora"** (lê a planilha e aplica mudanças externas ou marca conflito), **"Tentar novamente"** (reprocessa a fila de write-back manualmente, normalmente já reprocessada sozinha a cada 5 min), e **"Reconciliar com Dashboard"** (compara os totais do Postgres com a aba Dashboard, tolerância R$ 0,01, sem corrigir nada automaticamente — só reporta divergências).
4. Conflitos (edição simultânea na plataforma e na planilha) aparecem em Auditoria → Qualidade, com a ação "Resolver conflito" (manter dados da plataforma ou da planilha).

## 6. Criar usuários

Auditoria → Usuários → *Criar usuário* (nome, e-mail, perfil, senha temporária). A senha não é exibida novamente; o usuário troca no primeiro login. Também: ativar/desativar, resetar senha, alterar perfil, vincular a responsável legado.

## 7. Erros de sincronização

Auditoria → Sincronizações lista `sync_runs` e a fila (`sync_queue`). Falha de write-back não destrói a alteração local: ela fica em `sync_queue` com `status = pending|error` e destaque na tabela de Cobranças; "Tentar novamente" reprocessa. Conflito (`sync_status = conflict`) exibe valor da plataforma × valor da planilha para resolução manual em Auditoria → Qualidade.

## 8. Substituir o Google Sheets pela base financeira (futuro)

Implementar `FinancialDatabaseAdapter` (`src/integrations/receivables-source/financialDatabaseAdapter.ts`) com o mesmo contrato `ReceivablesSourceAdapter` e trocar o adaptador ativo. Registros passam a `origin = future_financial_database`; projetos provisórios são vinculados via *Vincular a registro oficial* (sem duplicar valores, sem mesclar por nome). Frontend, RLS, RPCs e auditoria não mudam.

## Comandos

`npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` · `npm run test` · `npm run seed:dev` (dados claramente fictícios `[DEV]`, exige `ALLOW_DEV_SEED=1`; produção usa a importação real via Google Sheets).
