import type { ReceivablesSourceAdapter } from "./types";
/** Futuro: base financeira oficial (a mesma do Power BI). Não implementado na V0 — mantém o contrato. */
const naoImplementado = () => { throw new Error("FinancialDatabaseAdapter ainda não implementado (fase futura)."); };
export const financialDatabaseAdapter: ReceivablesSourceAdapter = {
  name: "FinancialDatabaseAdapter",
  healthCheck: async () => ({ configured: false, healthy: false, message: "Não implementado nesta versão." }),
  initialize: naoImplementado, previewImport: naoImplementado, importData: naoImplementado, synchronize: naoImplementado,
  getReceivables: naoImplementado, updateOperationalFields: naoImplementado, updateFinancialFields: naoImplementado,
  retryQueue: naoImplementado, resolveConflict: naoImplementado,
};
