"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirPapel } from "./authService";
import { loginSchema, alterarSenhaSchema } from "@/lib/schemas/auth";
import { novoUsuarioSchema, atualizarPerfilSchema, resetarSenhaSchema, type NovoUsuarioInput, type AtualizarPerfilInput } from "@/lib/schemas/usuarios";

export interface FormState { erro?: string; ok?: boolean }

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

export async function logoutAction() { const s = await createClient(); await s.auth.signOut(); redirect("/login"); }

export async function alterarSenhaAction(_p: FormState, fd: FormData): Promise<FormState> {
  const s = alterarSenhaSchema.safeParse({ senha: fd.get("senha"), confirmar: fd.get("confirmar") });
  if (!s.success) return { erro: s.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: s.data.senha });
  if (error) return { erro: error.message };
  await supabase.rpc("rpc_password_changed");
  redirect("/visao-geral");
}

// ---- administração de usuários (master_admin). Auth Admin API só no servidor.
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
