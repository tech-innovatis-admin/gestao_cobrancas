import type { Filtros } from "@/services/receivablesService";
import type { Hub, ProjectStatus, RecordOrigin } from "@/types/domain";
export type SP = Record<string, string | undefined>;
export function filtrosDaUrl(sp: SP, userId?: string): Filtros {
  return { competencia: sp.competencia, hub: sp.hub as Hub | undefined, foundation: sp.foundation, institute: sp.institute, ministry: sp.ministry, q: sp.q, stage: sp.stage,
    status: (sp.status as ProjectStatus | "all" | undefined) ?? "active", etapa: sp.etapa, responsavel: sp.responsavel, origem: sp.origem as RecordOrigin | undefined,
    provisorios: sp.provisorios === "0" ? "0" : "1", fin: sp.fin as Filtros["fin"], prazoVencido: sp.prazo as "1" | undefined, flag: sp.flag, rapido: sp.rapido as Filtros["rapido"],
    page: Number(sp.page ?? 1), pageSize: Number(sp.size ?? 25), sort: sp.sort, dir: sp.dir as "asc" | "desc" | undefined, userId };
}
