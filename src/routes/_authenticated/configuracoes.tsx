import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { settingsQuery } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Ajustes do negócio — Comanda Fácil" },
      {
        name: "description",
        content:
          "Defina o nome e o logotipo do cliente exibidos no Comanda Fácil.",
      },
      { property: "og:title", content: "Ajustes do negócio — Comanda Fácil" },
      {
        property: "og:description",
        content: "Nome e logotipo do cliente no sistema de comandas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const settings = useQuery(settingsQuery);
  const [name, setName] = useState("");

  useEffect(() => {
    if (settings.data?.businessName) setName(settings.data.businessName);
  }, [settings.data?.businessName]);

  const saveName = useMutation({
    mutationFn: async (value: string) => {
      const trimmed = value.trim();
      if (trimmed.length < 2) throw new Error("Informe o nome do estabelecimento.");
      const { error } = await supabase
        .from("settings")
        .upsert({ id: true, business_name: trimmed.slice(0, 60) });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Nome atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveFlags = useMutation({
    mutationFn: async (patch: { service_fee_enabled?: boolean; discount_enabled?: boolean }) => {
      const { error } = await supabase.from("settings").upsert({ id: true, ...patch });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Ajustes do fechamento atualizados.");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      if (!file.type.startsWith("image/")) throw new Error("Envie um arquivo de imagem.");
      if (file.size > 2 * 1024 * 1024) throw new Error("A imagem deve ter até 2 MB.");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("branding")
        .upload(path, file, { upsert: true });
      if (uploadError) throw new Error(uploadError.message);
      const { error } = await supabase.from("settings").upsert({ id: true, logo_url: path });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Logo atualizada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeLogo = useMutation({
    mutationFn: async () => {
      const path = settings.data?.logoPath;
      const { error } = await supabase.from("settings").upsert({ id: true, logo_url: null });
      if (error) throw new Error(error.message);
      if (path) await supabase.storage.from("branding").remove([path]);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Logo removida.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black tracking-tight text-foreground">Ajustes</h1>

      {!isAdmin && (
        <p className="text-sm text-muted-foreground">
          Somente o administrador pode alterar o nome e a logo.
        </p>
      )}

      {isAdmin && (
        <>
          <div className="space-y-2">
            <Label htmlFor="business">Nome do cliente</Label>
            <Input
              id="business"
              className="h-12"
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              className="h-12 w-full font-bold"
              disabled={saveName.isPending}
              onClick={() => saveName.mutate(name)}
            >
              Salvar nome
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo">Logotipo do cliente</Label>
            {settings.data?.logoSrc && (
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <img
                  src={settings.data.logoSrc}
                  alt="Logo atual do estabelecimento"
                  className="h-20 w-auto max-w-[160px] object-contain"
                />
                <Button
                  variant="outline"
                  className="h-10"
                  disabled={removeLogo.isPending}
                  onClick={() => removeLogo.mutate()}
                >
                  Remover
                </Button>
              </div>
            )}
            <Input
              id="logo"
              type="file"
              accept="image/*"
              className="h-12"
              disabled={uploadLogo.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadLogo.mutate(file);
              }}
            />
            <p className="text-xs text-muted-foreground">
              PNG ou JPG, até 2 MB. Aparece ao lado da marca Comanda Fácil.
            </p>
          </div>

          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <Label>Fechamento de conta</Label>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Taxa de serviço (10%)</p>
                <p className="text-xs text-muted-foreground">
                  Mostra e soma a taxa no fechamento.
                </p>
              </div>
              <Switch
                checked={settings.data?.serviceFeeEnabled ?? true}
                disabled={saveFlags.isPending}
                onCheckedChange={(v) => saveFlags.mutate({ service_fee_enabled: v })}
                aria-label="Taxa de serviço no fechamento"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Desconto</p>
                <p className="text-xs text-muted-foreground">
                  Permite aplicar desconto no fechamento.
                </p>
              </div>
              <Switch
                checked={settings.data?.discountEnabled ?? true}
                disabled={saveFlags.isPending}
                onCheckedChange={(v) => saveFlags.mutate({ discount_enabled: v })}
                aria-label="Desconto no fechamento"
              />
            </div>
          </div>
        </>
      )}

    </div>
  );
}
