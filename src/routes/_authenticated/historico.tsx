import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useAuth } from "@/lib/auth";
import { endOfDayISO, salesQuery, startOfDayISO } from "@/lib/data";
import {
  PAYMENT_LABELS,
  PAYMENT_METHODS,
  formatBRL,
  formatDateTime,
  formatPhone,
  toCents,
} from "@/lib/money";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({
    meta: [
      { title: "Histórico de contas — Comandas Quiosque Maré" },
      {
        name: "description",
        content:
          "Consulte contas fechadas do Quiosque Maré por período e forma de pagamento, com cliente, telefone e total.",
      },
      { property: "og:title", content: "Histórico de contas — Comandas Quiosque Maré" },
      {
        property: "og:description",
        content: "Busque contas fechadas por período, cliente e forma de pagamento.",
      },
    ],
  }),
  component: HistoryPage,
});

function inputDate(offsetDays = 0) {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function HistoryPage() {
  const { isManager } = useAuth();
  const [from, setFrom] = useState(inputDate(-7));
  const [to, setTo] = useState(inputDate());
  const [payment, setPayment] = useState<string>("all");
  const [search, setSearch] = useState("");

  const fromISO = useMemo(() => startOfDayISO(new Date(`${from}T12:00:00`)), [from]);
  const toISO = useMemo(() => endOfDayISO(new Date(`${to}T12:00:00`)), [to]);
  const sales = useQuery(salesQuery(fromISO, toISO, payment));

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = sales.data ?? [];
    if (!term) return list;
    return list.filter((sale) => {
      const name = sale.accounts?.customer_name?.toLowerCase() ?? "";
      const phone = sale.accounts?.customer_phone ?? "";
      return name.includes(term) || phone.includes(term.replace(/\D/g, ""));
    });
  }, [sales.data, search]);

  const total = rows.reduce((acc, sale) => acc + toCents(sale.total), 0);

  if (!isManager) {
    return <p className="text-sm text-muted-foreground">Área restrita a administradores e gerentes.</p>;
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black tracking-tight text-foreground">Histórico</h1>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="from">De</Label>
          <Input
            id="from"
            type="date"
            className="h-12"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="to">Até</Label>
          <Input
            id="to"
            type="date"
            className="h-12"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Forma de pagamento</Label>
          <Select value={payment} onValueChange={setPayment}>
            <SelectTrigger className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {PAYMENT_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="search">Cliente ou celular</Label>
          <Input
            id="search"
            className="h-12"
            placeholder="Buscar…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-2xl bg-secondary/60 p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Total no período
        </p>
        <p className="text-2xl font-black tabular-nums text-foreground">{formatBRL(total)}</p>
        <p className="text-sm text-muted-foreground tabular-nums">{rows.length} contas</p>
      </div>

      <div className="space-y-2">
        {sales.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!sales.isLoading && rows.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma conta encontrada com esses filtros.
          </p>
        )}
        {rows.map((sale) => (
          <div
            key={sale.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-card p-3 shadow-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-bold text-foreground">
                {sale.accounts?.table_number ? `Mesa ${sale.accounts.table_number} · ` : ""}
                {sale.accounts?.customer_name ?? "Cliente"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {sale.accounts?.customer_phone ? formatPhone(sale.accounts.customer_phone) : "—"} ·{" "}
                {formatDateTime(sale.closed_at)}
              </p>
              <p className="text-xs font-semibold text-muted-foreground">
                {PAYMENT_LABELS[sale.payment_method as (typeof PAYMENT_METHODS)[number]]}
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
