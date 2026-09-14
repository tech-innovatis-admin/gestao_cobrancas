import { Badge, type badgeVariants } from "./badge";
import type { VariantProps } from "class-variance-authority";
import { FIN_LABEL, STATUS_LABEL, SYNC_LABEL, type FinStatus, type ProjectStatus, type StageColor, type SyncState } from "@/types/domain";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;
// StageColor (@/types/domain) não tem "red" — "lost"/"error"/"conflict" precisam dessa cor, então o mapa aceita StageColor | "red".
type Cor = StageColor | "red";
const corParaVariant: Record<Cor, BadgeVariant> = { green: "ok", blue: "info", orange: "warn", red: "danger", neutral: "secondary" };

const fin: Record<FinStatus, Cor> = { not_applicable: "neutral", open: "blue", partial: "orange", paid: "green" };
const st: Record<ProjectStatus, Cor> = { active: "green", backlog: "orange", lost: "red", archived: "neutral" };
const sy: Record<SyncState, Cor> = { synchronized: "green", pending: "orange", error: "red", conflict: "red", platform_only: "neutral" };

export const BadgeFin = ({ s }: { s: FinStatus }) => <Badge variant={corParaVariant[fin[s]]}>{FIN_LABEL[s]}</Badge>;
export const BadgeSituacao = ({ s }: { s: ProjectStatus }) => <Badge variant={corParaVariant[st[s]]}>{STATUS_LABEL[s]}</Badge>;
export const BadgeSync = ({ s, erro }: { s: SyncState; erro?: string | null }) => <Badge variant={corParaVariant[sy[s]]} title={erro ?? undefined}>{SYNC_LABEL[s]}</Badge>;
export const BadgeFase = ({ code, color, pending }: { code: string | null; color: StageColor | null; pending?: boolean }) =>
  pending || !code ? <Badge variant="warn" title="Fase pendente de classificação">Pendente</Badge> : <Badge variant={corParaVariant[color ?? "neutral"]} className="font-semibold">{code}</Badge>;
export const BadgeProvisorio = () => <Badge variant="warn" title="Registro provisório (CRM / pré-base)">CRM / Pré-base</Badge>;
export const BadgeConsolidado = () => <Badge variant="secondary" title="Julho/2026 contém cobranças consolidadas de competências vencidas até junho/2026.">Consolidado</Badge>;
