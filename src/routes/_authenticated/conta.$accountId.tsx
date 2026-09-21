import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Minus, Plus, Printer, StickyNote, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  accountItemsQuery,
  accountQuery,
  menuQuery,
  saleForAccountQuery,
  settingsQuery,
  type ItemRow,
} from "@/lib/data";
import { ReceiptPrint } from "@/components/ReceiptPrint";
import {
  PAYMENT_LABELS,
  PAYMENT_METHODS,
  formatBRL,
  formatPhone,
  formatTime,
  parseCurrencyInput,
  toCents,
  type PaymentMethod,
} from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/conta/$accountId")({
  head: () => ({
    meta: [
      { title: "Conta aberta — Comanda Fácil" },
      {
        name: "description",
        content:
          "Lance produtos, acompanhe o total e feche a conta com forma de pagamento no Tempero Mirim.",
      },
      { property: "og:title", content: "Conta aberta — Comanda Fácil" },
      {
        property: "og:description",
        content: "Lançamento rápido de produtos e fechamento da comanda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

type Group = {
  key: string;
  product_name: string;
  unit_price_cents: number;
  note: string | null;
  quantity: number;
  rows: ItemRow[];
};

function groupItems(items: ItemRow[]): Group[] {
  const map = new Map<string, Group>();
  for (const item of items) {
    const priceCents = toCents(item.unit_price);
    const key = `${item.product_name}|${priceCents}|${item.note ?? ""}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      existing.rows.push(item);
    } else {
      map.set(key, {
        key,
        product_name: item.product_name,
        unit_price_cents: priceCents,
        note: item.note,
        quantity: item.quantity,
        rows: [item],
      });
    }
  }
  return [...map.values()];
}

function AccountPage() {
  const { accountId } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const account = useQuery(accountQuery(accountId));
  const items = useQuery(accountItemsQuery(accountId));
  const menu = useQuery(menuQuery);
  const settings = useQuery(settingsQuery);
  const sale = useQuery({
    ...saleForAccountQuery(accountId),
    enabled: account.data?.status === "closed",
  });
  const serviceFeeEnabled = settings.data?.serviceFeeEnabled ?? true;
  const discountEnabled = settings.data?.discountEnabled ?? true;

  const [noteTarget, setNoteTarget] = useState<Group | null>(null);
  const [noteText, setNoteText] = useState("");
  const [removeTarget, setRemoveTarget] = useState<Group | null>(null);
  const [closing, setClosing] = useState(false);
  const [discountText, setDiscountText] = useState("");
  const [showDiscount, setShowDiscount] = useState(false);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`account-${accountId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "account_items", filter: `account_id=eq.${accountId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["account-items", accountId] });
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["account", accountId] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [accountId, queryClient]);

  const groups = useMemo(() => groupItems(items.data ?? []), [items.data]);
  const subtotalCents = groups.reduce((acc, g) => acc + g.unit_price_cents * g.quantity, 0);
  const discountCents =
    discountEnabled && showDiscount
      ? Math.min(parseCurrencyInput(discountText), subtotalCents)
      : 0;
  const serviceFeeCents = serviceFeeEnabled ? Math.round(subtotalCents * 0.1) : 0;
  const totalCents = subtotalCents + serviceFeeCents - discountCents;

  const invalidateItems = () => {
    void queryClient.invalidateQueries({ queryKey: ["account-items", accountId] });
    void queryClient.invalidateQueries({ queryKey: ["accounts"] });
  };

  const addProduct = useMutation({
    mutationFn: async (input: { productId: string | null; name: string; priceCents: number; note?: string | null }) => {
      const { error } = await supabase.from("account_items").insert({
        account_id: accountId,
        product_id: input.productId,
        product_name: input.name,
        unit_price: input.priceCents / 100,
        quantity: 1,
        note: input.note ?? null,
        created_by: user?.id ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidateItems,
    onError: (e: Error) => toast.error(e.message),
  });

  const decrement = useMutation({
    mutationFn: async (group: Group) => {
      const last = group.rows[group.rows.length - 1]!;
      if (last.quantity > 1) {
        const { error } = await supabase
          .from("account_items")
          .update({ quantity: last.quantity - 1 })
          .eq("id", last.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("account_items").delete().eq("id", last.id);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: invalidateItems,
    onError: (e: Error) => toast.error(e.message),
  });

  const removeGroup = useMutation({
    mutationFn: async (group: Group) => {
      const { error } = await supabase
        .from("account_items")
        .delete()
        .in("id", group.rows.map((r) => r.id));
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setRemoveTarget(null);
      invalidateItems();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveNote = useMutation({
    mutationFn: async ({ group, note }: { group: Group; note: string }) => {
      const { error } = await supabase
        .from("account_items")
        .update({ note: note.trim() ? note.trim().slice(0, 200) : null })
        .in("id", group.rows.map((r) => r.id));
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setNoteTarget(null);
      setNoteText("");
      invalidateItems();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeAccount = useMutation({
    mutationFn: async () => {
      if (!payment) throw new Error("Selecione a forma de pagamento.");
      if (groups.length === 0) throw new Error("Lance ao menos um produto antes de fechar.");
      // Fechamento transacional no banco: subtotal, desconto e total são
      // recalculados a partir dos itens reais da conta.
      const { error } = await supabase.rpc("close_account", {
        p_account_id: accountId,
        p_payment_method: payment,
        p_discount: discountCents / 100,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Conta fechada e pagamento registrado.");
      setClosing(false);
      void queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (account.isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!account.data) {
    return (
      <div className="space-y-4">
        <p className="font-semibold">Conta não encontrada.</p>
        <Link to="/" className="text-primary underline">
          Voltar para as contas
        </Link>
      </div>
    );
  }

  const isClosed = account.data.status === "closed";
  const saleData = sale.data;

  return (
    <>
      <div className="print-hidden space-y-5 pb-40">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/" aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            {account.data.table_number && (
              <span className="shrink-0 rounded-lg bg-primary px-2 py-1 text-xs font-black text-primary-foreground">
                MESA {account.data.table_number}
              </span>
            )}
            <h1 className="truncate text-xl font-black tracking-tight text-foreground">
              {account.data.customer_name}
            </h1>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {formatPhone(account.data.customer_phone)} · aberta às {formatTime(account.data.opened_at)}
          </p>
        </div>
      </div>

      {isClosed && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary p-4">
          <p className="text-sm font-semibold text-secondary-foreground">
            Esta conta já está fechada e não pode ser alterada.
          </p>
          <Button
            variant="default"
            className="h-12 shrink-0 rounded-xl px-4 text-sm font-bold"
            onClick={() => window.print()}
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimir fechamento
          </Button>
        </div>
      )}


      <div className="space-y-2">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
          Consumo
        </h2>
        {groups.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum produto lançado ainda.
          </p>
        )}
        {groups.map((group) => (
          <div key={group.key} className="rounded-2xl bg-card p-3 shadow-sm">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold text-foreground">{group.product_name}</p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {group.quantity} x {formatBRL(group.unit_price_cents)} ={" "}
                  <span className="font-bold text-foreground">
                    {formatBRL(group.unit_price_cents * group.quantity)}
                  </span>
                </p>
                {group.note && (
                  <p className="mt-1 truncate text-xs italic text-muted-foreground">
                    Obs.: {group.note}
                  </p>
                )}
              </div>
              {!isClosed && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-11 w-11 rounded-xl"
                    aria-label="Diminuir"
                    onClick={() => decrement.mutate(group)}
                  >
                    <Minus className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-11 w-11 rounded-xl"
                    aria-label="Aumentar"
                    onClick={() =>
                      addProduct.mutate({
                        productId: group.rows[0]?.product_id ?? null,
                        name: group.product_name,
                        priceCents: group.unit_price_cents,
                        note: group.note,
                      })
                    }
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 rounded-xl"
                    aria-label="Observação"
                    onClick={() => {
                      setNoteTarget(group);
                      setNoteText(group.note ?? "");
                    }}
                  >
                    <StickyNote className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 rounded-xl text-destructive"
                    aria-label="Remover"
                    onClick={() => setRemoveTarget(group)}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {!isClosed && (
        <div className="space-y-3">
          <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Lançar produtos
          </h2>
          <div className="flex flex-wrap gap-2">
            {(menu.data?.categories ?? [])
              .filter((c) =>
                (menu.data?.products ?? []).some((p) => p.category_id === c.id),
              )
              .map((category) => (
                <Button
                  key={category.id}
                  type="button"
                  variant={categoryId === category.id ? "default" : "secondary"}
                  className="h-12 rounded-xl px-4 text-sm font-bold"
                  onClick={() =>
                    setCategoryId((cur) => (cur === category.id ? null : category.id))
                  }
                >
                  {category.name}
                </Button>
              ))}
          </div>

          {!categoryId && (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Escolha uma categoria para ver os produtos.
            </p>
          )}

          {categoryId && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(menu.data?.products ?? [])
                .filter((p) => p.category_id === categoryId)
                .map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() =>
                      addProduct.mutate({
                        productId: product.id,
                        name: product.name,
                        priceCents: toCents(product.price),
                      })
                    }
                    className="flex h-20 flex-col items-start justify-between rounded-2xl bg-card p-3 text-left shadow-sm transition-transform active:scale-95"
                  >
                    <span className="line-clamp-2 text-sm font-bold leading-tight text-foreground">
                      {product.name}
                    </span>
                    <span className="text-sm font-black tabular-nums text-primary">
                      {formatBRL(toCents(product.price))}
                    </span>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}



      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border/60 bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:bottom-0">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Total
            </p>
            <p className="text-2xl font-black tabular-nums text-foreground">
              {formatBRL(subtotalCents)}
            </p>
          </div>
          {!isClosed && (
            <Button
              size="lg"
              className="h-14 shrink-0 rounded-2xl px-5 text-sm font-black sm:px-6 sm:text-base"
              onClick={() => {
                setDiscountText("");
                setPayment(null);
                setClosing(true);
              }}
            >
              <span className="sm:hidden">FECHAR</span>
              <span className="hidden sm:inline">FECHAR CONTA</span>
            </Button>
          )}
        </div>
      </div>

      <Dialog open={!!noteTarget} onOpenChange={(v) => !v && setNoteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Observação do item</DialogTitle>
            <DialogDescription>{noteTarget?.product_name}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={noteText}
            maxLength={200}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Ex.: sem gelo, bem passado…"
          />
          <DialogFooter>
            <Button
              className="h-12 w-full font-bold"
              onClick={() => noteTarget && saveNote.mutate({ group: noteTarget, note: noteText })}
              disabled={saveNote.isPending}
            >
              Salvar observação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(v) => !v && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover item?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.quantity} x {removeTarget?.product_name} será removido desta conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => removeTarget && removeGroup.mutate(removeTarget)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={closing} onOpenChange={setClosing}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fechar conta</DialogTitle>
            <DialogDescription>Revise o consumo e escolha a forma de pagamento.</DialogDescription>
          </DialogHeader>

          <div className="space-y-1 rounded-xl bg-secondary/60 p-3 text-sm">
            {groups.map((g) => (
              <div key={g.key} className="flex justify-between gap-3 tabular-nums">
                <span className="truncate">
                  {g.quantity} x {g.product_name}
                </span>
                <span className="font-semibold">{formatBRL(g.unit_price_cents * g.quantity)}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-border pt-2 tabular-nums">
              <span>Subtotal</span>
              <span className="font-semibold">{formatBRL(subtotalCents)}</span>
            </div>
            {serviceFeeEnabled && (
              <div className="flex justify-between tabular-nums">
                <span>Taxa de serviço (10%)</span>
                <span className="font-semibold">{formatBRL(serviceFeeCents)}</span>
              </div>
            )}
            {discountEnabled && showDiscount && (
              <div className="flex justify-between tabular-nums">
                <span>Desconto</span>
                <span className="font-semibold">- {formatBRL(discountCents)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-black tabular-nums">
              <span>TOTAL</span>
              <span>{formatBRL(totalCents)}</span>
            </div>
          </div>

          {discountEnabled && (
            <div className="space-y-2">
              {!showDiscount ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-12 w-full rounded-xl font-bold"
                  onClick={() => setShowDiscount(true)}
                >
                  Desconto
                </Button>
              ) : (
                <>
                  <Label htmlFor="discount">Desconto em R$</Label>
                  <Input
                    id="discount"
                    inputMode="decimal"
                    autoFocus
                    className="h-12 text-lg"
                    placeholder="0,00"
                    value={discountText}
                    onChange={(e) => setDiscountText(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 w-full text-sm"
                    onClick={() => {
                      setShowDiscount(false);
                      setDiscountText("");
                    }}
                  >
                    Remover desconto
                  </Button>
                </>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((method) => (
                <Button
                  key={method}
                  type="button"
                  variant={payment === method ? "default" : "secondary"}
                  className="h-14 rounded-xl text-base font-bold"
                  onClick={() => setPayment(method)}
                >
                  {PAYMENT_LABELS[method]}
                </Button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              className="h-14 w-full text-base font-black"
              disabled={!payment || closeAccount.isPending}
              onClick={() => setConfirming(true)}
            >
              CONFIRMAR PAGAMENTO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar fechamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Total {formatBRL(totalCents)} em {payment ? PAYMENT_LABELS[payment] : "—"}. Depois de
              confirmada, a conta não pode mais ser alterada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirming(false);
                closeAccount.mutate();
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>

      {isClosed && (
        <ReceiptPrint
          businessName={settings.data?.businessName ?? "Tempero Mirim"}
          customerName={account.data.customer_name}
          tableNumber={account.data.table_number}
          openedAt={account.data.opened_at}
          closedAt={saleData?.closed_at ?? account.data.closed_at}
          items={groups.map((g) => ({
            name: g.product_name,
            quantity: g.quantity,
            unitPriceCents: g.unit_price_cents,
            note: g.note,
          }))}
          subtotalCents={subtotalCents}
          serviceFeeCents={serviceFeeCents}
          discountCents={saleData ? toCents(saleData.discount) : discountCents}
          totalCents={saleData ? toCents(saleData.total) : totalCents}
          paymentLabel={
            saleData ? (PAYMENT_LABELS[saleData.payment_method as PaymentMethod] ?? null) : null
          }
        />
      )}
    </>
  );
}
