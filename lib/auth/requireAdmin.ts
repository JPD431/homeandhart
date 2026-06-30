import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { isAdminUserId } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export async function getAdminUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !isAdminUserId(user.id)) {
    return null;
  }

  return user;
}

export async function requireAdminPage(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = await getAdminUser();
  if (!admin) {
    redirect("/");
  }

  return admin;
}
