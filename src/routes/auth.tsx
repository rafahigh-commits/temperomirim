import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { getPublicBranding } from "@/lib/branding.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import systemLogo from "@/assets/logo-comanda-facil.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Comanda Fácil" },
      {
        name: "description",
        content:
          "Acesse o Comanda Fácil para abrir contas, lançar produtos e registrar pagamentos do Tempero Mirim.",
      },
      { property: "og:title", content: "Entrar — Comanda Fácil" },
      {
        property: "og:description",
        content: "Acesso da equipe do Tempero Mirim ao Comanda Fácil.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres").max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const fetchBranding = useServerFn(getPublicBranding);
  const { data: settings } = useQuery({
    queryKey: ["public-branding"],
    queryFn: () => fetchBranding(),
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
      else setChecking(false);
    });
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signInSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      toast.error("Não foi possível entrar. Verifique e-mail e senha.");
      return;
    }
    navigate({ to: "/", replace: true });
  };

  if (checking) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img
            src={systemLogo.url}
            alt="Comanda Fácil"
            className="mx-auto h-28 w-auto max-w-[240px] object-contain"
          />
          <div className="mt-5 flex items-center justify-center gap-3 border-t border-border pt-5">
            {settings?.logoSrc ? (
              <img
                src={settings.logoSrc}
                alt={`Logotipo ${settings.businessName}`}
                className="h-12 w-12 rounded-md object-contain"
              />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-md bg-primary text-sm font-black text-primary-foreground">
                TM
              </div>
            )}
            <div className="text-left">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Cliente</p>
              <h1 className="text-lg font-black text-foreground">
                {settings?.businessName ?? "Tempero Mirim"}
              </h1>
            </div>
          </div>
        </div>

        <form onSubmit={handleSignIn} className="space-y-4 rounded-2xl bg-card p-5 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required className="h-12" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-12"
            />
          </div>
          <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={loading}>
            Entrar
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Novos acessos são criados pelo administrador do quiosque.
          </p>
        </form>
      </div>
    </div>
  );
}
