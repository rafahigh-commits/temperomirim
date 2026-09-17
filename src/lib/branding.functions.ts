import { createServerFn } from "@tanstack/react-start";

export const getPublicBranding = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("settings")
    .select("business_name, logo_url")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;

  let logoSrc: string | null = null;
  if (data?.logo_url) {
    const { data: signed } = await supabaseAdmin.storage
      .from("branding")
      .createSignedUrl(data.logo_url, 60 * 60 * 24);
    logoSrc = signed?.signedUrl ?? null;
  }

  return {
    businessName: data?.business_name ?? "Tempero Mirim",
    logoSrc,
  };
});
