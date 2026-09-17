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

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Comandas Quiosque Maré" },
      {
        name: "description",
        content:
          "Acesse o sistema de comandas do Quiosque Maré para abrir contas, lançar produtos e registrar pagamentos.",
      },
      { property: "og:title", content: "Entrar — Comandas Quiosque Maré" },
      {
        property: "og:description",
        content: "Acesso da equipe ao sistema de comandas do Quiosque Maré.",
      },
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
          {settings?.logoSrc ? (
            <img
              src={settings.logoSrc}
              alt={`Logotipo ${settings.businessName}`}
              className="mx-auto h-20 w-auto max-w-[200px] object-contain"
            />
          ) : (
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary text-xl font-black text-primary-foreground">
              QM
            </div>
          )}
          <h1 className="mt-4 text-2xl font-black tracking-tight text-foreground">
            {settings?.businessName ?? "Comandas Quiosque Maré"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Acesso da equipe</p>
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
