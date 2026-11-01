import { getPublicSupabase } from "@/app/lib/supabase-public";

/** true si hay al menos un artículo publicado (el blog solo se indexa entonces). */
export async function hasPublishedPosts() {
  try {
    const { count, error } = await getPublicSupabase()
      .from("blog_posts")
      .select("id", { count: "exact", head: true })
      .eq("publicado", true);
    return !error && (count ?? 0) > 0;
  } catch {
    return false;
  }
}
