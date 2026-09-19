import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StaffUser = {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "gerente" | "atendente";
  active: boolean;
  created_at: string;
};

type AuthedClient = {
  from: (t: "user_roles" | "profiles") => {
    select: (c: string) => {
      eq: (
        c: string,
        v: string,
      ) => Promise<{ data: Record<string, unknown>[] | null; error: unknown }> & {
        maybeSingle: () => Promise<{
          data: { active: boolean } | null;
          error: unknown;
        }>;
      };
    };
  };
};

/** Rejects any caller whose profile is missing or deactivated. */
async function assertActiveUser(supabase: AuthedClient, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("active")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data?.active) {
    throw new Error("Usuário inativo. Entre em contato com um administrador.");
  }
}

/** Active + admin. An inactive user is never treated as admin. */
async function assertActiveAdmin(supabase: AuthedClient, userId: string) {
  await assertActiveUser(supabase, userId);
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error || !(data ?? []).some((r) => r["role"] === "admin")) {
    throw new Error("Apenas administradores podem gerenciar usuários.");
  }
}

const assertAdmin = assertActiveAdmin;

export const listStaffUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, active, created_at")
        .order("created_at", { ascending: true }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (rErr) throw new Error(rErr.message);
    const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
    return (profiles ?? []).map<StaffUser>((p) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      active: p.active,
      created_at: p.created_at,
      role: (roleMap.get(p.id) ?? "atendente") as "admin" | "gerente" | "atendente",
    }));
  });

const createSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
  fullName: z.string().trim().min(2).max(80),
  role: z.enum(["admin", "gerente", "atendente"]),
});

export const createStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Não foi possível criar o usuário.");
    const uid = created.user.id;
    try {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert(
          { id: uid, full_name: data.fullName, email: data.email.toLowerCase(), active: true },
          { onConflict: "id" },
        );
      if (profileError) throw profileError;

      const { error: clearRoleError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", uid);
      if (clearRoleError) throw clearRoleError;

      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: uid, role: data.role });
      if (roleError) throw roleError;

      const [{ data: profile }, { data: assignedRole }] = await Promise.all([
        supabaseAdmin.from("profiles").select("id, active").eq("id", uid).maybeSingle(),
        supabaseAdmin.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
      ]);
      if (!profile?.active || assignedRole?.role !== data.role) {
        throw new Error("O acesso não foi concluído corretamente.");
      }

      return { id: uid };
    } catch (setupError) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      const message = setupError instanceof Error ? setupError.message : "Falha ao preparar o acesso.";
      throw new Error(`Não foi possível concluir o cadastro: ${message}`);
    }
  });

const updateSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(80).optional(),
  role: z.enum(["admin", "gerente", "atendente"]).optional(),
  active: z.boolean().optional(),
});

export const updateStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    if (data.userId === context.userId && (data.active === false || (data.role !== undefined && data.role !== "admin"))) {
      throw new Error("Você não pode remover o seu próprio acesso de administrador.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.fullName !== undefined || data.active !== undefined) {
      const patch: { full_name?: string; active?: boolean } = {};
      if (data.fullName !== undefined) patch.full_name = data.fullName;
      if (data.active !== undefined) patch.active = data.active;
      const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
      if (error) throw new Error(error.message);
    }
    if (data.role !== undefined) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
