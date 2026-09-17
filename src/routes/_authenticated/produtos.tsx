import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { catalogQuery } from "@/lib/data";
import { formatBRL, parseCurrencyInput, toCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos e categorias — Comanda Fácil" },
      {
        name: "description",
        content:
          "Cadastre produtos, defina preços, categorias e ative ou inative itens do cardápio do Tempero Mirim.",
      },
      { property: "og:title", content: "Produtos e categorias — Comanda Fácil" },
      {
        property: "og:description",
        content: "Gestão do cardápio: produtos, preços, categorias e disponibilidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductsPage,
});

type ProductDraft = {
  id?: string;
  name: string;
  price: string;
  category_id: string;
  active: boolean;
};

function ProductsPage() {
  const { isManager } = useAuth();
  const queryClient = useQueryClient();
  const catalog = useQuery(catalogQuery);
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<{ id?: string; name: string } | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["catalog"] });
    void queryClient.invalidateQueries({ queryKey: ["menu"] });
  };

  const saveProduct = useMutation({
    mutationFn: async (input: ProductDraft) => {
      const name = input.name.trim();
      if (name.length < 2) throw new Error("Informe o nome do produto.");
      const priceCents = parseCurrencyInput(input.price);
      if (priceCents <= 0) throw new Error("Informe um preço válido.");
      if (!input.category_id) throw new Error("Escolha uma categoria.");
      const payload = {
        name: name.slice(0, 80),
        price: priceCents / 100,
        category_id: input.category_id,
        active: input.active,
        updated_at: new Date().toISOString(),
      };
      const { error } = input.id
        ? await supabase.from("products").update(payload).eq("id", input.id)
        : await supabase.from("products").insert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setDraft(null);
      invalidate();
      toast.success("Produto salvo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("products").update({ active }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const saveCategory = useMutation({
    mutationFn: async (input: { id?: string; name: string }) => {
      const name = input.name.trim();
      if (name.length < 2) throw new Error("Informe o nome da categoria.");
      const { error } = input.id
        ? await supabase.from("categories").update({ name }).eq("id", input.id)
        : await supabase.from("categories").insert({ name, sort_order: 99 });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setCategoryDraft(null);
      invalidate();
      toast.success("Categoria salva.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isManager) {
    return <p className="text-sm text-muted-foreground">Área restrita a administradores e gerentes.</p>;
  }

  const categories = catalog.data?.categories ?? [];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black tracking-tight text-foreground">Produtos</h1>

      <Tabs defaultValue="produtos">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="space-y-4">
          <Button
            size="lg"
            className="h-14 w-full rounded-2xl text-base font-bold"
            onClick={() =>
              setDraft({ name: "", price: "", category_id: categories[0]?.id ?? "", active: true })
            }
          >
            <Plus className="mr-2 h-5 w-5" /> Novo produto
          </Button>

          {categories.map((category) => {
            const products = (catalog.data?.products ?? []).filter(
              (p) => p.category_id === category.id,
            );
            return (
              <div key={category.id} className="space-y-2">
                <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  {category.name}
                </h2>
                {products.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum produto nesta categoria.</p>
                )}
                {products.map((product) => (
                  <div key={product.id} className="rounded-2xl bg-card p-3 shadow-sm">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-foreground">{product.name}</p>
                        <p className="text-sm font-semibold tabular-nums text-primary">
                          {formatBRL(toCents(product.price))}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Switch
                          checked={product.active}
                          onCheckedChange={(v) =>
                            toggleActive.mutate({ id: product.id, active: v })
                          }
                          aria-label="Ativo"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11"
                          aria-label="Editar"
                          onClick={() =>
                            setDraft({
                              id: product.id,
                              name: product.name,
                              price: String(Number(product.price).toFixed(2)).replace(".", ","),
                              category_id: product.category_id ?? "",
                              active: product.active,
                            })
                          }
                        >
                          <Pencil className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="categorias" className="space-y-3">
          <Button
            size="lg"
            className="h-14 w-full rounded-2xl text-base font-bold"
            onClick={() => setCategoryDraft({ name: "" })}
          >
            <Plus className="mr-2 h-5 w-5" /> Nova categoria
          </Button>
          {categories.map((category) => (
            <div
              key={category.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-card p-3 shadow-sm"
            >
              <p className="truncate font-bold text-foreground">{category.name}</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0"
                aria-label="Editar categoria"
                onClick={() => setCategoryDraft({ id: category.id, name: category.name })}
              >
                <Pencil className="h-5 w-5" />
              </Button>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!draft} onOpenChange={(v) => !v && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product-name">Nome</Label>
                <Input
                  id="product-name"
                  className="h-12"
                  maxLength={80}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-price">Preço (R$)</Label>
                <Input
                  id="product-price"
                  className="h-12"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={draft.category_id}
                  onValueChange={(v) => setDraft({ ...draft, category_id: v })}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Escolha" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-secondary/60 p-3">
                <Label htmlFor="product-active">Ativo para lançamento</Label>
                <Switch
                  id="product-active"
                  checked={draft.active}
                  onCheckedChange={(v) => setDraft({ ...draft, active: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              className="h-12 w-full font-bold"
              disabled={saveProduct.isPending}
              onClick={() => draft && saveProduct.mutate(draft)}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!categoryDraft} onOpenChange={(v) => !v && setCategoryDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{categoryDraft?.id ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          </DialogHeader>
          {categoryDraft && (
            <div className="space-y-2">
              <Label htmlFor="category-name">Nome</Label>
              <Input
                id="category-name"
                className="h-12"
                maxLength={40}
                value={categoryDraft.name}
                onChange={(e) => setCategoryDraft({ ...categoryDraft, name: e.target.value })}
              />
            </div>
          )}
          <DialogFooter>
            <Button
              className="h-12 w-full font-bold"
              disabled={saveCategory.isPending}
              onClick={() => categoryDraft && saveCategory.mutate(categoryDraft)}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
