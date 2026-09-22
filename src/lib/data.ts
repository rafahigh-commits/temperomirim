import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { toCents } from "./money";

export type AccountRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  table_number: string | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
};

export type ItemRow = {
  id: string;
  account_id: string;
  product_id: string | null;
  product_name: string;
  unit_price: number | string;
  quantity: number;
  note: string | null;
  created_at: string;
};

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("settings")
      .select("business_name, logo_url, service_fee_enabled, discount_enabled")
      .eq("id", true)
      .maybeSingle();
    if (error) throw error;
    let logoSrc: string | null = null;
    if (data?.logo_url) {
      const { data: signed } = await supabase.storage
        .from("branding")
        .createSignedUrl(data.logo_url, 60 * 60 * 24);
      logoSrc = signed?.signedUrl ?? null;
    }
    return {
      businessName: data?.business_name ?? "Tempero Mirim",
      logoPath: data?.logo_url ?? null,
      logoSrc,
      serviceFeeEnabled: data?.service_fee_enabled ?? true,
      discountEnabled: data?.discount_enabled ?? true,
    };
  },
  staleTime: 5 * 60 * 1000,
});

export const openAccountsQuery = queryOptions({
  queryKey: ["accounts", "open"],
  queryFn: async () => {
    const { data: accounts, error } = await supabase
      .from("accounts")
      .select("id, customer_name, customer_phone, table_number, status, opened_at, closed_at")
      .eq("status", "open")
      .order("opened_at", { ascending: true });
    if (error) throw error;
    const ids = (accounts ?? []).map((a) => a.id);
    let totals: Record<string, number> = {};
    if (ids.length) {
      const { data: items, error: itemsError } = await supabase
        .from("account_items")
        .select("account_id, unit_price, quantity")
        .in("account_id", ids);
      if (itemsError) throw itemsError;
      totals = (items ?? []).reduce<Record<string, number>>((acc, it) => {
        acc[it.account_id] = (acc[it.account_id] ?? 0) + toCents(it.unit_price) * it.quantity;
        return acc;
      }, {});
    }
    return (accounts ?? []).map((a) => ({ ...a, totalCents: totals[a.id] ?? 0 }));
  },
});

export function accountQuery(accountId: string) {
  return queryOptions({
    queryKey: ["account", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, customer_name, customer_phone, table_number, status, opened_at, closed_at")
        .eq("id", accountId)
        .maybeSingle();
      if (error) throw error;
      return (data as AccountRow) ?? null;
    },
  });
}

export function accountItemsQuery(accountId: string) {
  return queryOptions({
    queryKey: ["account-items", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_items")
        .select("id, account_id, product_id, product_name, unit_price, quantity, note, created_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ItemRow[];
    },
  });
}

export const menuQuery = queryOptions({
  queryKey: ["menu"],
  queryFn: async () => {
    const [{ data: categories, error: catError }, { data: products, error: prodError }] =
      await Promise.all([
        supabase.from("categories").select("id, name, sort_order").order("sort_order"),
        supabase
          .from("products")
          .select("id, name, price, active, category_id")
          .eq("active", true)
          .order("name"),
      ]);
    if (catError) throw catError;
    if (prodError) throw prodError;
    return { categories: categories ?? [], products: products ?? [] };
  },
});

export const catalogQuery = queryOptions({
  queryKey: ["catalog"],
  queryFn: async () => {
    const [{ data: categories, error: catError }, { data: products, error: prodError }] =
      await Promise.all([
        supabase.from("categories").select("id, name, sort_order").order("sort_order"),
        supabase
          .from("products")
          .select("id, name, price, active, category_id")
          .order("name"),
      ]);
    if (catError) throw catError;
    if (prodError) throw prodError;
    return { categories: categories ?? [], products: products ?? [] };
  },
});

export type SaleRow = {
  id: string;
  account_id: string;
  subtotal: number | string;
  discount: number | string;
  total: number | string;
  payment_method: string;
  closed_at: string;
  accounts: {
    table_number: string | null;
    customer_name: string;
    customer_phone: string;
    opened_at: string;
  } | null;
};

export function salesQuery(fromISO: string, toISO: string, payment: string | "all") {
  return queryOptions({
    queryKey: ["sales", fromISO, toISO, payment],
    queryFn: async () => {
      let q = supabase
        .from("sales")
        .select(
          "id, account_id, subtotal, discount, total, payment_method, closed_at, accounts(table_number, customer_name, customer_phone, opened_at)",
        )
        .gte("closed_at", fromISO)
        .lte("closed_at", toISO)
        .order("closed_at", { ascending: false });
      if (payment !== "all") q = q.eq("payment_method", payment);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as SaleRow[];
    },
  });
}

export function saleForAccountQuery(accountId: string) {
  return queryOptions({
    queryKey: ["sale", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, subtotal, discount, total, payment_method, closed_at")
        .eq("account_id", accountId)
        .order("closed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function tipClosingQuery(day: string) {
  return queryOptions({
    queryKey: ["tip-closing", day],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tip_closings")
        .select("day, total_cents, people_count, per_person_cents")
        .eq("day", day)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function startOfDayISO(d = new Date()): string {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s.toISOString();
}

export function endOfDayISO(d = new Date()): string {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e.toISOString();
}
