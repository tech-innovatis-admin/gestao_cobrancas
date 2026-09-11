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
