import { createClient } from "@/lib/supabase/server";
import { Profile, UserRole } from "@/types";
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}

export async function requireAuth(allowedRoles?: UserRole[]) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    redirect("/");
  }

  if (profile.role === "artist" && !profile.is_active) {
    redirect("/login?error=disabled");
  }

  return profile;
}
