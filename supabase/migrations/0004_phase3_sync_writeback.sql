-- =============================================================================
-- 0004: write-back financeiro (fila), RPC de sistema p/ sincronização externa,
-- constraint de sync_queue.operation, e agendamento via pg_cron + pg_net.
-- =============================================================================

-- Write-back financeiro: alinhar rpc_update_receivable_financial ao mesmo padrão de fila
-- que rpc_update_receivable_operational já usa (0002_views_rpc.sql). Assinatura de parâmetros
-- idêntica à versão atual — só a lógica de fila/versionamento foi adicionada.
create or replace function public.rpc_update_receivable_financial(
  p_id uuid, p_planned_project numeric, p_planned_innovatis numeric, p_received_project numeric, p_received_innovatis numeric,
  p_competence date, p_flag text, p_origin public.record_origin, p_provisional boolean, p_legacy_consolidated boolean, p_justification text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare cur public.receivables%rowtype;
begin
  perform public.assert_role(array['master_admin']::public.app_role[]);
  select * into cur from public.receivables where id = p_id and active for update;
  if not found then raise exception 'Recebível não encontrado.'; end if;

  perform public.audit_ctx('financial_update', jsonb_build_object('justification', p_justification));

  update public.receivables set
    planned_project = p_planned_project, planned_innovatis = p_planned_innovatis,
    received_project = p_received_project, received_innovatis = p_received_innovatis,
    competence = p_competence, flag = nullif(btrim(p_flag), ''), origin = p_origin,
    provisional = p_provisional, legacy_consolidated = p_legacy_consolidated,
    source_version = source_version + 1,
    sync_status = case when source_type = 'google_sheets' then 'pending'::public.sync_state else sync_status end
  where id = p_id;

  -- write-back para a planilha (processado pela Edge Function process-sync-queue), no mesmo
  -- padrão que rpc_update_receivable_operational já usa.
  if cur.source_type = 'google_sheets' then
    insert into public.sync_queue (receivable_id, operation, payload) values (p_id, 'writeback_financial',
      jsonb_build_object('planned_project', p_planned_project, 'planned_innovatis', p_planned_innovatis,
        'received_project', p_received_project, 'received_innovatis', p_received_innovatis, 'version', cur.source_version + 1));
  end if;

  return jsonb_build_object('ok', true);
end $$;

-- RPC de sistema: aplica uma mudança vinda da planilha (sincronização ou resolução de conflito
-- "keep_sheet") numa ÚNICA transação (audit_ctx + update juntos — nunca separados em duas chamadas
-- de rede, que perderiam o set_config transaction-local). Só chamável via client service_role
-- (nunca exposta a authenticated/anon).
create or replace function public.rpc_apply_external_sync(
  p_id uuid, p_planned_project numeric, p_planned_innovatis numeric, p_received_project numeric, p_received_innovatis numeric,
  p_reason text, p_action text, p_responsible_legacy_name text, p_new_hash text, p_action_type text, p_metadata jsonb default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.audit_ctx(p_action_type, p_metadata);
  update public.receivables set
    planned_project = coalesce(p_planned_project, planned_project),
    planned_innovatis = coalesce(p_planned_innovatis, planned_innovatis),
    received_project = coalesce(p_received_project, received_project),
    received_innovatis = coalesce(p_received_innovatis, received_innovatis),
    reason = p_reason, action = p_action, responsible_legacy_name = p_responsible_legacy_name,
    source_hash = p_new_hash, source_version = source_version + 1, sync_status = 'synchronized'
  where id = p_id;
end $$;
revoke execute on function public.rpc_apply_external_sync(uuid, numeric, numeric, numeric, numeric, text, text, text, text, text, jsonb) from public, authenticated, anon;

-- Segurança barata: valores possíveis de operation em sync_queue.
alter table public.sync_queue add constraint sync_queue_operation_check check (operation in ('writeback_operational', 'writeback_financial'));

-- Agendamento real via pg_cron + pg_net. As URLs/keys NUNCA ficam em texto claro nesta migration —
-- são lidas do Supabase Vault (segredos 'project_url' e 'service_role_key'). Esses segredos devem
-- ser criados MANUALMENTE via SQL Editor DEPOIS do deploy desta migration, por exemplo:
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service-role-key>', 'service_role_key');
-- Sem esses dois segredos os jobs abaixo rodam a cada execução mas falham silenciosamente
-- (net.http_post com url nula) até que sejam cadastrados.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'process-sync-queue-every-5min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/process-sync-queue',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'synchronize-google-sheets-every-30min',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/synchronize-google-sheets',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
