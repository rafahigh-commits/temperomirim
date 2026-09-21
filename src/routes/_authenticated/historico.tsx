import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";

import { ReceiptPrint, type ReceiptItem } from "@/components/ReceiptPrint";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { endOfDayISO, salesQuery, settingsQuery, startOfDayISO, type SaleRow } from "@/lib/data";
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
      { title: "Histórico de contas — Comanda Fácil" },
      {
        name: "description",
        content:
          "Consulte contas fechadas do Tempero Mirim por período e forma de pagamento, com cliente, telefone e total.",
      },
      { property: "og:title", content: "Histórico de contas — Comanda Fácil" },
      {
        property: "og:description",
        content: "Busque contas fechadas por período, cliente e forma de pagamento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const [receipt, setReceipt] = useState<{ sale: SaleRow; items: ReceiptItem[] } | null>(null);

  const fromISO = useMemo(() => startOfDayISO(new Date(`${from}T12:00:00`)), [from]);
  const toISO = useMemo(() => endOfDayISO(new Date(`${to}T12:00:00`)), [to]);
  const sales = useQuery(salesQuery(fromISO, toISO, payment));
  const settings = useQuery(settingsQuery);

  const preparePrint = useMutation({
    mutationFn: async (sale: SaleRow) => {
      const { data, error } = await supabase
        .from("account_items")
        .select("product_name, unit_price, quantity, note")
        .eq("account_id", sale.account_id)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return {
        sale,
        items: (data ?? []).map((item) => ({
          name: item.product_name,
          quantity: item.quantity,
          unitPriceCents: toCents(item.unit_price),
          note: item.note,
        })),
      };
    },
    onSuccess: setReceipt,
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!receipt) return;
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.print());
    });
    return () => window.cancelAnimationFrame(frame);
  }, [receipt]);

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
    <>
    <div className="print-hidden space-y-5">
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
            <div className="flex shrink-0 items-center gap-2">
              <p className="font-black tabular-nums text-foreground">
                {formatBRL(toCents(sale.total))}
              </p>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={`Imprimir fechamento de ${sale.accounts?.customer_name ?? "cliente"}`}
                title="Imprimir fechamento"
                disabled={preparePrint.isPending}
                onClick={() => preparePrint.mutate(sale)}
              >
                <Printer className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
    {receipt?.sale.accounts && (
      <ReceiptPrint
        businessName={settings.data?.businessName ?? "Tempero Mirim"}
        customerName={receipt.sale.accounts.customer_name}
        tableNumber={receipt.sale.accounts.table_number}
        openedAt={receipt.sale.accounts.opened_at}
        closedAt={receipt.sale.closed_at}
        items={receipt.items}
        subtotalCents={toCents(receipt.sale.subtotal)}
        serviceFeeCents={Math.max(
          0,
          toCents(receipt.sale.total) - toCents(receipt.sale.subtotal) + toCents(receipt.sale.discount),
        )}
        discountCents={toCents(receipt.sale.discount)}
        totalCents={toCents(receipt.sale.total)}
        paymentLabel={PAYMENT_LABELS[receipt.sale.payment_method] ?? null}
      />
    )}
    </>
  );
}
