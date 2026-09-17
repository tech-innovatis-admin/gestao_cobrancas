import { LogOut } from "lucide-react";
import { logoutAction } from "@/services/authActions";
import { ultimaSync } from "@/services/auditService";
import { fmtDataHora } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL, type Profile } from "@/types/domain";

type SyncBadgeVariant = "ok" | "warn" | "danger" | "secondary";
const syncVariantByStatus: Record<string, [SyncBadgeVariant, string]> = {
  success: ["ok", "Sincronizado"],
  running: ["warn", "Pendente"],
  partial: ["warn", "Pendente"],
  error: ["danger", "Erro"],
  not_configured: ["warn", "Configuração pendente"],
};

export const Topbar = async ({ titulo, perfil, extra }: { titulo: string; perfil: Profile; extra?: React.ReactNode }) => {
  const s = await ultimaSync();
  const [variant, label] = syncVariantByStatus[s.status] ?? ["secondary", s.status];
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-4"><h1 className="text-[16px] font-semibold text-foreground uppercase tracking-wide">{titulo}</h1>{extra}</div>
      <div className="flex items-center gap-5">
        <div className="text-right text-[11px] text-muted-foreground">Última sincronização<div className="flex items-center justify-end gap-1.5 text-foreground"><Badge variant={variant}>{label}</Badge>{s.finished_at && <span>{fmtDataHora(s.finished_at)}</span>}</div></div>
        <div className="text-right leading-tight"><div className="text-[13px] font-medium">{perfil.full_name}</div><div className="text-[11px] text-muted-foreground">{perfil.email} · {ROLE_LABEL[perfil.role]}</div></div>
        <form action={logoutAction}><Button type="submit" variant="ghost" size="icon" title="Sair"><LogOut size={15} /></Button></form>
      </div>
    </header>
  );
};
