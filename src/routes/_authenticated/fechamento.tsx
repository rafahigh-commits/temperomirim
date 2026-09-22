import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { endOfDayISO, salesQuery, startOfDayISO, tipClosingQuery } from "@/lib/data";
import { PAYMENT_LABELS, PAYMENT_METHODS, formatBRL, formatTime, toCents } from "@/lib/money";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/fechamento")({
  head: () => ({
    meta: [
      { title: "Fechamento do dia — Comanda Fácil" },
      {
        name: "description",
        content:
          "Resumo diário de faturamento do Tempero Mirim por forma de pagamento, com contas fechadas e ticket médio.",
      },
      { property: "og:title", content: "Fechamento do dia — Comanda Fácil" },
      {
        property: "og:description",
        content: "Faturamento do dia por dinheiro, Pix, débito e crédito.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClosingPage,
});

function todayInput() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function ClosingPage() {
  const { isManager } = useAuth();
  const [day, setDay] = useState(todayInput());
  const dayDate = useMemo(() => new Date(`${day}T12:00:00`), [day]);
  const sales = useQuery(salesQuery(startOfDayISO(dayDate), endOfDayISO(dayDate), "all"));

  const totals = useMemo(() => {
    const rows = sales.data ?? [];
    const byMethod = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, 0])) as Record<
      (typeof PAYMENT_METHODS)[number],
      number
    >;
    let total = 0;
    let discount = 0;
    for (const sale of rows) {
      const cents = toCents(sale.total);
      total += cents;
      discount += toCents(sale.discount);
      byMethod[sale.payment_method as (typeof PAYMENT_METHODS)[number]] += cents;
    }
    return {
      total,
      discount,
      byMethod,
      count: rows.length,
      average: rows.length ? Math.round(total / rows.length) : 0,
    };
  }, [sales.data]);

  const tipsTotal = Math.round(totals.total * 0.1);
  const queryClient = useQueryClient();
  const tipClosing = useQuery(tipClosingQuery(day));
  const [people, setPeople] = useState("");

  useEffect(() => {
    setPeople(tipClosing.data?.people_count ? String(tipClosing.data.people_count) : "");
  }, [tipClosing.data, day]);

  const peopleCount = Number(people.replace(/\D/g, ""));
  const perPerson = peopleCount > 0 ? Math.round(tipsTotal / peopleCount) : null;

  const saveTips = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tip_closings").upsert(
        {
          day,
          total_cents: tipsTotal,
          people_count: peopleCount,
          per_person_cents: perPerson ?? 0,
        },
        { onConflict: "day" },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Divisão de gorjetas salva.");
      queryClient.invalidateQueries({ queryKey: ["tip-closing", day] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!isManager) {
    return <p className="text-sm text-muted-foreground">Área restrita a administradores e gerentes.</p>;
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black tracking-tight text-foreground">Fechamento do dia</h1>

      <div className="space-y-2">
        <Label htmlFor="day">Dia</Label>
        <Input
          id="day"
          type="date"
          className="h-12 max-w-xs"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
      </div>

      <div className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest opacity-80">Faturamento</p>
        <p className="text-4xl font-black tabular-nums">{formatBRL(totals.total)}</p>
        <p className="mt-1 text-sm opacity-80 tabular-nums">
          {totals.count} contas · ticket médio {formatBRL(totals.average)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {PAYMENT_METHODS.map((method) => (
          <div key={method} className="rounded-2xl bg-card p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {PAYMENT_LABELS[method]}
            </p>
            <p className="text-xl font-black tabular-nums text-foreground">
              {formatBRL(totals.byMethod[method])}
            </p>
          </div>
        ))}
      </div>

      {totals.discount > 0 && (
        <p className="text-sm text-muted-foreground tabular-nums">
          Descontos concedidos: {formatBRL(totals.discount)}
        </p>
      )}

      <div className="space-y-2">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
          Contas fechadas
        </h2>
        {sales.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!sales.isLoading && (sales.data ?? []).length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma conta fechada neste dia.
          </p>
        )}
        {(sales.data ?? []).map((sale) => (
          <div
            key={sale.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-card p-3 shadow-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-bold text-foreground">
                {sale.accounts?.table_number ? `Mesa ${sale.accounts.table_number} · ` : ""}
                {sale.accounts?.customer_name ?? "Cliente"}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatTime(sale.closed_at)} · {PAYMENT_LABELS[sale.payment_method as (typeof PAYMENT_METHODS)[number]]}
              </p>
            </div>
            <p className="shrink-0 font-black tabular-nums text-foreground">
              {formatBRL(toCents(sale.total))}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
