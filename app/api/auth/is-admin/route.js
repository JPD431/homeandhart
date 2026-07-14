import { NextResponse } from "next/server";
import { isAdminUserId } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ isAdmin: false });
  }

  return NextResponse.json({ isAdmin: isAdminUserId(user.id) });
}
