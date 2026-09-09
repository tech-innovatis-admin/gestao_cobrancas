import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
export const Skeleton = ({ className }: { className?: string }) => <div className={cn("animate-pulse rounded bg-line/70", className)} />;
export const EmptyState = ({ msg }: { msg: string }) => <div className="flex items-center justify-center px-4 py-10 text-[13px] text-ink-faint">{msg}</div>;
export const Erro = ({ msg }: { msg?: string | null }) =>
  msg ? (
    <Alert variant="destructive">
      <AlertDescription>{msg}</AlertDescription>
    </Alert>
  ) : null;
export const Pendente = ({ msg = "Configuração pendente" }: { msg?: string }) => <span className="badge b-orange">{msg}</span>;
