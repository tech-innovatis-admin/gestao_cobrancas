import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  senha: z.string().min(1, "Informe a senha."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const alterarSenhaSchema = z
  .object({
    senha: z.string().min(8, "Mínimo de 8 caracteres."),
    confirmar: z.string(),
  })
  .refine((d) => d.senha === d.confirmar, { message: "As senhas não conferem.", path: ["confirmar"] });
export type AlterarSenhaInput = z.infer<typeof alterarSenhaSchema>;
