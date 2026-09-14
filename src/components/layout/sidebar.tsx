"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListChecks, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/types/domain";
const itens = [
  { href: "/visao-geral", label: "Visão Geral", icon: LayoutDashboard, master: false },
  { href: "/cobrancas", label: "Cobranças", icon: ListChecks, master: false },
  { href: "/auditoria", label: "Auditoria", icon: ShieldCheck, master: true },
];
export const Sidebar = ({ role }: { role: AppRole }) => {
  const path = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-52 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-5 py-5"><div className="text-[15px] font-bold tracking-wide">INNOVATIS</div><div className="text-[12px] text-muted-foreground">Gestão de Cobranças</div></div>
      <nav className="flex-1 px-3 py-4">
        {itens.filter((i) => !i.master || role === "master_admin").map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={cn("mb-1 flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px]", path.startsWith(href) ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground")}><Icon size={15} strokeWidth={1.75} />{label}</Link>
        ))}
      </nav>
      <div className="border-t border-sidebar-border px-5 py-3 text-[11px] text-muted-foreground">V0 · uso interno</div>
    </aside>
  );
};
