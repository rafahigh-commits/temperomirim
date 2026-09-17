import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

type AuthValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  role: "admin" | "gerente" | "atendente" | null;
  fullName: string;
};

const AuthContext = createContext<AuthValue>({
  session: null,
  user: null,
  loading: true,
  isAdmin: false,
  isManager: false,
  role: null,
  fullName: "",
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<"admin" | "gerente" | "atendente" | null>(null);
  const [fullName, setFullName] = useState("");
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const loadRole = async (uid: string) => {
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("profiles").select("full_name, active").eq("id", uid).maybeSingle(),
      ]);
      if (!active) return;
      if (!profile?.active) {
        toast.error("Usuário inativo. Entre em contato com um administrador.");
        await supabase.auth.signOut();
        queryClient.clear();
        return;
      }
      const list = roles ?? [];
      setIsAdmin(list.some((r) => r.role === "admin"));
      setRole(
        list.some((r) => r.role === "admin")
          ? "admin"
          : list.some((r) => r.role === "gerente")
            ? "gerente"
            : list.length
              ? "atendente"
              : null,
      );
      setFullName(profile?.full_name ?? "");
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) void loadRole(data.session.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setSession(newSession);
      setLoading(false);
      if (newSession?.user) {
        void loadRole(newSession.user.id);
      } else {
        setIsAdmin(false);
        setRole(null);
        setFullName("");
      }
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient, router]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        isAdmin,
        isManager: isAdmin || role === "gerente",
        role,
        fullName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
