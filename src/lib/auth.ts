import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types";
import { redirect } from "next/navigation";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile | null) ?? null;
}

/**
 * Exige sesión y, opcionalmente, un rol. Un creador suspendido o una cuenta
 * deshabilitada no pasan. Siempre vuelve a verificarse aquí aunque el middleware ya lo hizo.
 */
export async function requireAuth(allowedRoles?: UserRole[]): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.is_active) redirect("/login?error=disabled");

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    redirect(allowedRoles.includes("creator") && profile.role === "fan" ? "/become-creator" : "/");
  }

  if (profile.role === "creator") {
    const supabase = await createClient();
    const { data: creator } = await supabase
      .from("creators")
      .select("status")
      .eq("user_id", profile.id)
      .maybeSingle();
    if (creator?.status === "suspended" && allowedRoles?.includes("creator") && !allowedRoles.includes("admin")) {
      redirect("/login?error=suspended");
    }
  }
  return profile;
}
