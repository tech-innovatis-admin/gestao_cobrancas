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
