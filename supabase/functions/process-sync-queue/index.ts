// FASE 3 — process-sync-queue
// Contrato: ver src/integrations/receivables-source/types.ts e docs/fase-3-google-sheets.md.
// Processa a fila sync_queue (alimentada por rpc_update_receivable_operational/financial e por
// resolve-sync-conflict com resolution=keep_platform), aplicando o write-back na planilha.
// Roda via cron (service_role) ou disparo manual de um master_admin.
import { requireMasterAdminOrService } from "../_shared/auth.ts";
import { json, loadConfig } from "../_shared/google.ts";
import { writebackFinancial, writebackOperational, type FinancialWritebackFields, type OperationalWritebackFields } from "../_shared/writeback.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try { await requireMasterAdminOrService(req); } catch (e) { return json({ error: (e as Error).message }, 401); }
  const cfg = loadConfig();
  if ("missing" in cfg) return json({ error: `Configuração pendente: secrets ausentes (${cfg.missing.join(", ")})` }, 503);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: pending, error: pendingErr } = await admin
    .from("sync_queue").select("*").eq("status", "pending").order("created_at").limit(20);
  if (pendingErr) return json({ error: pendingErr.message }, 500);

  let processed = 0;
  let errors = 0;

  for (const item of pending ?? []) {
    await admin.from("sync_queue").update({ status: "processing" }).eq("id", item.id);
    try {
      if (item.operation === "writeback_operational") {
        await writebackOperational(admin, cfg, item.receivable_id, item.payload as OperationalWritebackFields);
      } else if (item.operation === "writeback_financial") {
        await writebackFinancial(admin, cfg, item.receivable_id, item.payload as FinancialWritebackFields);
      } else {
        throw new Error(`Operação desconhecida: ${item.operation}`);
      }
      await admin.from("sync_queue").update({ status: "done", processed_at: new Date().toISOString() }).eq("id", item.id);
      processed++;
    } catch (e) {
      await admin.from("sync_queue").update({
        status: "error",
        last_error: (e as Error).message,
        attempts: (item.attempts ?? 0) + 1,
      }).eq("id", item.id);
      errors++;
    }
  }

  return json({ processed, errors, remaining: (pending?.length ?? 0) - processed - errors });
});
