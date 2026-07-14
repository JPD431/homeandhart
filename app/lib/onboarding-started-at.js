import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * Fija onboarding_started_at la primera vez que el usuario entra en alta de proveedor.
 * @param {import("@supabase/supabase-js").SupabaseClient} [client]
 */
export async function ensureOnboardingStartedAt(userId, client = supabaseAdmin) {
  if (!userId) return;

  const { data: profile } = await client
    .from("profiles")
    .select("onboarding_started_at, onboarding_completed_at, role")
    .eq("id", userId)
    .maybeSingle();

  if (
    !profile ||
    profile.role !== "proveedor" ||
    profile.onboarding_completed_at ||
    profile.onboarding_started_at
  ) {
    return;
  }

  await client
    .from("profiles")
    .update({ onboarding_started_at: new Date().toISOString() })
    .eq("id", userId);
}
