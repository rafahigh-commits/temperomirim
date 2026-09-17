import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, ClipboardList, Package, CalendarClock, History, Settings, Users } from "lucide-react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
const systemLogoUrl = "/logo-comanda-facil.png";

export function AppShell({ children }: { children: ReactNode }) {
  const { data: settings } = useQuery(settingsQuery);
  const { isAdmin, isManager, role, fullName } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const navItems = [
    { to: "/", label: "Contas", icon: ClipboardList, admin: false, manager: false },
    { to: "/produtos", label: "Produtos", icon: Package, admin: false, manager: true },
    { to: "/fechamento", label: "Fechamento", icon: CalendarClock, admin: false, manager: true },
    { to: "/historico", label: "Histórico", icon: History, admin: false, manager: true },
    { to: "/usuarios", label: "Usuários", icon: Users, admin: true, manager: false },
    { to: "/configuracoes", label: "Ajustes", icon: Settings, admin: true, manager: false },
  ] as const;

  const visible = navItems.filter((i) => (i.admin ? isAdmin : i.manager ? isManager : true));

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-card/95 backdrop-blur">
        <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
            <img
              src={systemLogoUrl}
              alt="Comanda Fácil"
              className="h-12 w-auto max-w-[104px] shrink-0 object-contain sm:h-14 sm:max-w-[128px]"
            />
            <div className="h-10 w-px shrink-0 bg-border" aria-hidden="true" />
            <div className="flex min-w-0 items-center gap-2.5">
              {settings?.logoSrc ? (
                <img
                  src={settings.logoSrc}
                  alt={`Logotipo ${settings.businessName}`}
                  className="h-9 w-9 shrink-0 rounded-md object-contain sm:h-11 sm:w-11"
                />
              ) : (
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary text-xs font-black text-primary-foreground sm:h-11 sm:w-11">
                  TM
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold leading-tight text-foreground sm:text-base">
                  {settings?.businessName ?? "Tempero Mirim"}
                </p>
                <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
                  {fullName || "Atendimento"} · {role === "admin" ? "Admin" : role === "gerente" ? "Gerente" : "Atendente"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <nav className="hidden items-center gap-1 md:flex">
              {visible.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.to === "/" }}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[status=active]:bg-primary/10 data-[status=active]:text-primary"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sair">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-card/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-5xl items-stretch justify-around">
          {visible.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold text-muted-foreground transition-colors data-[status=active]:text-primary"
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
