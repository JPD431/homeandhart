import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isAdminUserId } from "@/lib/auth/admin";
import {
  getPendingInvitesForUser,
  linkPendingInvitesToProfile,
} from "@/app/lib/familia-invites";
import {
  ONBOARDING_PROFILE_SELECT,
  resolvePostAuthRedirect,
} from "@/app/lib/onboarding";
import { createClient } from "@/lib/supabase/server";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

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

  try {
    await linkPendingInvitesToProfile(supabaseAdmin, user.id, user.email);
  } catch (err) {
    console.error("[post-login-redirect] Error vinculando invitación familia:", err);
  }

  const pendingInvites = await getPendingInvitesForUser(
    supabaseAdmin,
    user.id,
    user.email,
  );
  if (pendingInvites.length > 0) {
    return NextResponse.json({ redirect: "/familia" });
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
