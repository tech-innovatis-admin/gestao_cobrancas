import type { Receivable } from "@/types/domain";
/**
 * Contrato da fonte de recebíveis. O Supabase é a base operacional; a FONTE (Sheets hoje,
 * base financeira amanhã) só conversa com a plataforma através deste contrato, via Edge Functions.
 */
export interface ImportPreview { sheets: { name: string; isMonthly: boolean; competence?: string }[]; receivables: number; idsPresent: number; idsMissing: number; duplicates: number; stagesFound: Record<string, number>; issues: string[]; }
export interface ImportResult { runId: string; read: number; created: number; updated: number; ignored: number; errors: number; conflicts: number; }
export interface InitializeResult { runId: string; sheetsProcessed: number; idsCreated: number; idsAlreadyPresent: number; }
export interface OperationalFields { collection_status_id: string | null; responsible_user_id: string | null; responsible_legacy_name: string | null; operational_deadline: string | null; reason: string | null; action: string | null; }
export interface FinancialFields { planned_project: number; planned_innovatis: number; received_project: number; received_innovatis: number; }
export interface SourceStatus { configured: boolean; healthy: boolean; message: string; }
export interface QueueResult { processed: number; errors: number; remaining: number; }
export type ConflictResolution = "keep_platform" | "keep_sheet";

export interface ReceivablesSourceAdapter {
  readonly name: string;
  healthCheck(): Promise<SourceStatus>;
  initialize(): Promise<InitializeResult>;
  previewImport(): Promise<ImportPreview>;
  importData(): Promise<ImportResult>;
  synchronize(): Promise<ImportResult>;
  getReceivables(): Promise<Receivable[]>;
  updateOperationalFields(receivableId: string, fields: OperationalFields): Promise<void>;
  updateFinancialFields(receivableId: string, fields: FinancialFields): Promise<void>;
  retryQueue(): Promise<QueueResult>;
  resolveConflict(receivableId: string, resolution: ConflictResolution): Promise<{ ok: boolean }>;
}
