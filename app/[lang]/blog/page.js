import BlogIndexView from "@/app/[lang]/blog/BlogIndexView";
import { estimateReadingTime } from "@/app/lib/blog-seed";
import { getPublicSupabase } from "@/app/lib/supabase-public";
import { hasPublishedPosts } from "@/app/lib/blog-status";
import JsonLd from "@/app/components/JsonLd";
import { pageSchema, resolveLang, staticPageMetadata } from "@/app/lib/seo";

const PAGE_SIZE = 9;

/** Sustituye el texto completo por el tiempo de lectura: no se envía al cliente. */
function toCardPost(post) {
  if (!post) return null;
  const { contenido, ...rest } = post;
  return { ...rest, readMin: estimateReadingTime(contenido) };
}

export const revalidate = 3600;

export async function generateMetadata({ params }) {
  // Sin artículos publicados: noindex hasta que haya al menos uno.
  return staticPageMetadata("blog", "/blog", await resolveLang(params), {
    noindex: !(await hasPublishedPosts()),
  });
}

export default async function BlogPage({ params, searchParams }) {
  const lang = await resolveLang(params);
  const sp = await searchParams;
  const categoria = sp?.categoria || "todos";
  const page = Math.max(1, parseInt(sp?.page || "1", 10));

  let featured = null;
  let posts = [];
  let totalGrid = 0;

  try {
    const supabase = getPublicSupabase();

    let featuredQuery = supabase
      .from("blog_posts")
      .select("*")
      .eq("publicado", true)
      .eq("featured", true)
      .order("created_at", { ascending: false })
      .limit(1);

    if (categoria !== "todos") {
      featuredQuery = featuredQuery.eq("categoria", categoria);
    }

    const { data: featuredData } = await featuredQuery;
    featured = featuredData?.[0] ?? null;

    let countQuery = supabase
      .from("blog_posts")
      .select("id", { count: "exact", head: true })
      .eq("publicado", true);

    if (categoria !== "todos") {
      countQuery = countQuery.eq("categoria", categoria);
    }
    if (featured?.id) {
      countQuery = countQuery.neq("id", featured.id);
    }

    const { count } = await countQuery;
    totalGrid = count ?? 0;

    const offset = (page - 1) * PAGE_SIZE;

    let gridQuery = supabase
      .from("blog_posts")
      .select("*")
      .eq("publicado", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (categoria !== "todos") {
      gridQuery = gridQuery.eq("categoria", categoria);
    }
    if (featured?.id) {
      gridQuery = gridQuery.neq("id", featured.id);
    }

    const { data: gridData } = await gridQuery;
    posts = gridData ?? [];
  } catch {
    posts = [];
    featured = null;
    totalGrid = 0;
  }

  const totalPages = Math.max(1, Math.ceil(totalGrid / PAGE_SIZE));

  return (
    <>
    <JsonLd data={pageSchema("blog", "/blog", lang, "Blog")} />
    <BlogIndexView
      featured={toCardPost(featured)}
      posts={posts.map(toCardPost)}
      categoria={categoria}
      page={page}
      totalPages={totalPages}
    />
    </>
  );
}
