// FASE 3 — update-receivable-operational
// Contrato: ver src/integrations/receivables-source/types.ts e docs/fase-3-google-sheets.md.
// Write-back imediato dos campos operacionais para a planilha de origem (chamada síncrona,
// tipicamente logo após a plataforma persistir a mudança). Usa writebackOperational, que lança
// erro se o recebível não tiver source_sheet_name/source_top_row (não é oriundo de planilha).
import { requireMasterAdmin } from "../_shared/auth.ts";
import { json, loadConfig } from "../_shared/google.ts";
import { writebackOperational, type OperationalWritebackFields } from "../_shared/writeback.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

interface Body extends OperationalWritebackFields { id?: string }

Deno.serve(async (req) => {
  try { await requireMasterAdmin(req); } catch (e) { return json({ error: (e as Error).message }, 401); }
  const cfg = loadConfig();
  if ("missing" in cfg) return json({ error: `Configuração pendente: secrets ausentes (${cfg.missing.join(", ")})` }, 503);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "Corpo inválido." }, 400); }
  const { id, ...fields } = body;
  if (!id) return json({ error: "id é obrigatório." }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    await writebackOperational(admin, cfg, id, fields as OperationalWritebackFields);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
