import { z } from "zod";

export const projetoSchema = z.object({
  name: z.string().min(2),
  stage_code: z.enum(["A", "B", "C", "D"]).nullable(),
  project_status: z.enum(["active", "backlog", "lost"]),
  hub: z.enum(["IFES", "GOV"]),
  ministry_government: z.string().nullable(),
  institute: z.string().nullable(),
  foundation: z.string().nullable(),
  origin: z.enum(["google_sheets", "crm", "platform", "future_financial_database"]),
  provisional: z.boolean(),
  notes: z.string().nullable(),
});
export type ProjetoInput = z.infer<typeof projetoSchema>;
