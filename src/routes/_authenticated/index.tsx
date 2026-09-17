import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, ChevronRight, Clock, Phone } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  endOfDayISO,
  openAccountsQuery,
  salesQuery,
  startOfDayISO,
} from "@/lib/data";
import { formatBRL, formatPhone, formatTime, onlyDigits, toCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Contas abertas — Comandas Quiosque Maré" },
      {
        name: "description",
        content:
          "Painel de contas abertas do Quiosque Maré: abra novas comandas, acompanhe o consumo e o total do dia.",
      },
      { property: "og:title", content: "Contas abertas — Comandas Quiosque Maré" },
      {
        property: "og:description",
        content: "Abra comandas, lance produtos e acompanhe o consumo em tempo real.",
      },
    ],
  }),
  component: Dashboard,
});

const openSchema = z.object({
  customer_name: z.string().trim().min(2, "Informe o nome do cliente").max(80),
  customer_phone: z
    .string()
    .refine((v) => onlyDigits(v).length >= 10 && onlyDigits(v).length <= 11, {
      message: "Informe um celular válido com DDD",
    }),
  table_number: z.string().trim().max(10).optional(),
});

function Dashboard() {
  const { isManager, user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");

  const accounts = useQuery(openAccountsQuery);
  const todaySales = useQuery({
    ...salesQuery(startOfDayISO(), endOfDayISO(), "all"),
    enabled: isManager,
  });

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-accounts")
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "account_items" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const createAccount = useMutation({
    mutationFn: async (form: FormData) => {
      const parsed = openSchema.safeParse({
        customer_name: form.get("customer_name"),
        customer_phone: form.get("customer_phone"),
        table_number: form.get("table_number"),
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]!.message);
      const table = parsed.data.table_number?.trim();
      const { data, error } = await supabase
        .from("accounts")
        .insert({
          customer_name: parsed.data.customer_name,
          customer_phone: onlyDigits(parsed.data.customer_phone),
          table_number: table ? table : null,
          opened_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505" || error.code === "23P01" || error.message.includes("duplicate")) {
          if (error.message.includes("table")) {
            throw new Error("Já existe uma conta aberta para esta mesa.");
          }
          throw new Error("Já existe uma conta aberta para este celular.");
        }
        throw new Error(error.message);
      }
      return data.id as string;
    },
    onSuccess: (id) => {
      setOpen(false);
      setPhone("");
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      navigate({ to: "/conta/$accountId", params: { accountId: id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sales = todaySales.data ?? [];
  const totalDay = sales.reduce((acc, s) => acc + toCents(s.total), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight text-foreground">Contas abertas</h1>
        <span className="rounded-full bg-secondary px-3 py-1 text-sm font-bold text-secondary-foreground">
          {accounts.data?.length ?? 0}
        </span>
      </div>

      <Button
        size="lg"
        className="h-16 w-full rounded-2xl text-lg font-black tracking-wide shadow-sm"
        onClick={() => setOpen(true)}
      >
        <Plus className="mr-2 h-6 w-6" /> ABRIR NOVA CONTA
      </Button>

      {isManager && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Vendido hoje" value={formatBRL(totalDay)} highlight />
          <StatCard label="Abertas" value={String(accounts.data?.length ?? 0)} />
          <StatCard label="Fechadas" value={String(sales.length)} />
        </div>
      )}

      <div className="space-y-3">
        {accounts.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {accounts.data?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="font-semibold text-foreground">Nenhuma conta aberta</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Toque em “Abrir nova conta” para começar o atendimento.
            </p>
          </div>
        )}
        {accounts.data?.map((account) => (
          <Link
            key={account.id}
            to="/conta/$accountId"
            params={{ accountId: account.id }}
            className="block rounded-2xl bg-card p-4 shadow-sm transition-transform active:scale-[0.99]"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  {account.table_number && (
                    <span className="shrink-0 rounded-lg bg-primary px-2 py-1 text-xs font-black text-primary-foreground">
                      MESA {account.table_number}
                    </span>
                  )}
                  <p className="truncate text-lg font-bold text-foreground">
                    {account.customer_name}
                  </p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {formatPhone(account.customer_phone)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {formatTime(account.opened_at)}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xl font-black tabular-nums text-foreground">
                  {formatBRL(account.totalCents)}
                </span>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Abrir nova conta</DialogTitle>
            <DialogDescription>
              Celular e nome são obrigatórios. A mesa é opcional.
            </DialogDescription>
          </DialogHeader>
          <form
            id="open-account-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              createAccount.mutate(new FormData(e.currentTarget));
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="customer_phone">Celular</Label>
              <Input
                id="customer_phone"
                name="customer_phone"
                inputMode="tel"
                className="h-14 text-lg"
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_name">Nome do cliente</Label>
              <Input
                id="customer_name"
                name="customer_name"
                className="h-14 text-lg"
                maxLength={80}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="table_number">Mesa / comanda (opcional)</Label>
              <Input
                id="table_number"
                name="table_number"
                className="h-14 text-lg"
                inputMode="numeric"
                maxLength={10}
                placeholder="01"
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                size="lg"
                className="h-14 w-full text-base font-bold"
                disabled={createAccount.isPending}
              >
                Abrir conta
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-3 shadow-sm ${highlight ? "bg-primary text-primary-foreground" : "bg-card text-foreground"}`}
    >
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
        {label}
      </p>
      <p className="mt-1 text-lg font-black tabular-nums">{value}</p>
    </div>
  );
}
