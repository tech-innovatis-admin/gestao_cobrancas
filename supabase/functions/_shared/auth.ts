// Valida o JWT do chamador e exige master_admin (o servidor sempre revalida a permissão).
import { createClient } from "npm:@supabase/supabase-js@2";

export async function requireMasterAdmin(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: profile } = await supabase.from("profiles").select("role, active").eq("user_id", user.id).single();
  if (!profile?.active || profile.role !== "master_admin") throw new Error("Somente Master Admin");
  return { user, supabase };
}

// Para Edge Functions chamadas tanto por um Master Admin (via UI) quanto pelo próprio sistema
// (pg_cron/pg_net com a service_role key, sem usuário autenticado — ex.: process-sync-queue,
// synchronize-google-sheets). Compara o token recebido com a service role key antes de tentar
// validar como usuário, para não pagar uma chamada de Auth desnecessária em chamadas de sistema.
export async function requireMasterAdminOrService(
  req: Request,
): Promise<{ user: Awaited<ReturnType<typeof requireMasterAdmin>>["user"] | null; supabase: Awaited<ReturnType<typeof requireMasterAdmin>>["supabase"] | null; isSystem: boolean }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && token === serviceKey) return { user: null, supabase: null, isSystem: true };
  const { user, supabase } = await requireMasterAdmin(req);
  return { user, supabase, isSystem: false };
}
