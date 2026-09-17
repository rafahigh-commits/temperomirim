import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

type Role = "admin" | "gerente" | "atendente";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { createStaffUser, type StaffUser } from "@/lib/users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — Comandas Quiosque Maré" },
      {
        name: "description",
        content:
          "Área administrativa para criar e gerenciar os usuários da equipe do Quiosque Maré.",
      },
      { property: "og:title", content: "Usuários — Comandas Quiosque Maré" },
      {
        property: "og:description",
        content: "Cadastro e gestão de acessos da equipe do Quiosque Maré.",
      },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const { isAdmin, loading } = useAuth();
  const queryClient = useQueryClient();
  const createFn = useServerFn(createStaffUser);

  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("atendente");

  const users = useQuery({
    queryKey: ["staff-users"],
    enabled: isAdmin,
    queryFn: async (): Promise<StaffUser[]> => {
      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, active, created_at")
          .order("created_at", { ascending: true }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (pErr) throw new Error(pErr.message);
      if (rErr) throw new Error(rErr.message);
      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
      return (profiles ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        active: p.active,
        created_at: p.created_at,
        role: (roleMap.get(p.id) ?? "atendente") as Role,
      }));
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["staff-users"] });
  };

  const createUser = useMutation({
    mutationFn: (input: { email: string; password: string; fullName: string; role: Role }) =>
      createFn({ data: input }),
    onSuccess: () => {
      toast.success("Usuário criado.");
      setOpen(false);
      setRole("atendente");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateUser = useMutation({
    mutationFn: async (input: { userId: string; role?: Role; active?: boolean }) => {
      if (input.active !== undefined) {
        const { error } = await supabase
          .from("profiles")
          .update({ active: input.active })
          .eq("id", input.userId);
        if (error) throw new Error(error.message);
      }
      if (input.role !== undefined) {
        await supabase.from("user_roles").delete().eq("user_id", input.userId);
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: input.userId, role: input.role });
        if (error) throw new Error(error.message);
      }
      return { ok: true };
    },
    onSuccess: () => {
      toast.success("Usuário atualizado.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!isAdmin) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Apenas administradores podem gerenciar usuários.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-black tracking-tight text-foreground">Usuários</h1>
        <Button onClick={() => setOpen(true)}>Novo usuário</Button>
      </div>

      <div className="space-y-2">
        {users.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {(users.data ?? []).map((u) => (
          <div key={u.id} className="rounded-2xl bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold text-foreground">{u.full_name || "Sem nome"}</p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <Select
                  value={u.role}
                  onValueChange={(value) =>
                    updateUser.mutate({ userId: u.id, role: value as Role })
                  }
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
                    <SelectItem value="atendente">Atendente</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={u.active}
                    aria-label={u.active ? "Desativar usuário" : "Ativar usuário"}
                    onCheckedChange={(checked) =>
                      updateUser.mutate({ userId: u.id, active: checked })
                    }
                  />
                  <span className="text-xs font-semibold text-muted-foreground">
                    {u.active ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const fullName = String(form.get("fullName") ?? "").trim();
              const email = String(form.get("email") ?? "").trim();
              const password = String(form.get("password") ?? "");
              if (fullName.length < 2) {
                toast.error("Informe o nome.");
                return;
              }
              if (!email.includes("@")) {
                toast.error("E-mail inválido.");
                return;
              }
              if (password.length < 6) {
                toast.error("A senha deve ter no mínimo 6 caracteres.");
                return;
              }
              createUser.mutate({ fullName, email, password, role });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome</Label>
              <Input id="fullName" name="fullName" required maxLength={80} className="h-12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">E-mail</Label>
              <Input id="new-email" name="email" type="email" required className="h-12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Senha</Label>
              <Input id="new-password" name="password" type="password" required className="h-12" />
            </div>
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="atendente">Atendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" className="h-12 w-full" disabled={createUser.isPending}>
                Criar usuário
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
