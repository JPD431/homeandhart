import { NextResponse } from "next/server";
import { isAdminUserId } from "@/lib/auth/admin";
import {
  ONBOARDING_PROFILE_SELECT,
  resolvePostAuthRedirect,
} from "@/app/lib/onboarding";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ redirect: "/login" });
  }

  if (isAdminUserId(user.id)) {
    return NextResponse.json({ redirect: "/admin" });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(ONBOARDING_PROFILE_SELECT)
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[post-login-redirect] Error cargando perfil:", profileError.message);
  }

  const redirect = profile
    ? resolvePostAuthRedirect(profile)
    : resolvePostAuthRedirect({
        role: user.user_metadata?.role || "cliente",
      });

  return NextResponse.json({ redirect });
}
