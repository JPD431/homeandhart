import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import { SERIF } from "@/app/components/brand";
import {
  BLOG_CATEGORIAS,
  CATEGORIA_COLORS,
  CATEGORIA_LABELS,
  estimateReadingTime,
  formatBlogDate,
} from "@/app/lib/blog-seed";
import { getPublicSupabase } from "@/app/lib/supabase-public";

const PAGE_SIZE = 9;
const BORDER = "#e8e4de";
const WARM = "#f7f5f2";

export const revalidate = 3600;

function getImageUrl(categoria, slug, width = 800, height = 400) {
  const seed = slug.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const imageId = (seed % 1000) + 1;
  void categoria;
  void imageId;
  return `https://picsum.photos/seed/${slug}/${width}/${height}`;
}

function getPostImageUrl(post, width = 400, height = 200) {
  return post.imagen_url || getImageUrl(post.categoria, post.slug, width, height);
}

function BlogCard({ post, large = false }) {
  const color = CATEGORIA_COLORS[post.categoria] || "#1d4f91";
  const readMin = estimateReadingTime(post.contenido);
  const imageUrl = getPostImageUrl(post, 400, 200);

  return (
    <article
      className={`overflow-hidden rounded-xl border bg-white transition-shadow hover:shadow-md ${large ? "md:flex" : ""}`}
      style={{ borderColor: BORDER }}
    >
      <div
        className={`relative shrink-0 overflow-hidden ${large ? "h-48 w-full md:h-auto md:w-2/5" : "h-40 w-full"}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={post.titulo}
          style={{ width: "100%", height: 200, objectFit: "cover" }}
        />
        <span
          className="absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          {CATEGORIA_LABELS[post.categoria] || post.categoria}
        </span>
      </div>
      <div className={`flex flex-col p-4 ${large ? "md:flex-1 md:p-6" : ""}`}>
        <h2
          className={`font-semibold text-[#1a1a1a] ${large ? "text-xl sm:text-2xl" : "text-[15px] leading-snug"}`}
          style={large ? { fontFamily: SERIF, fontWeight: 400 } : undefined}
        >
          <Link href={`/blog/${post.slug}`} className="no-underline text-inherit hover:opacity-80">
            {post.titulo}
          </Link>
        </h2>
        {post.subtitulo && (
          <p className={`mt-2 text-[#666] ${large ? "text-sm leading-relaxed" : "text-[12px] line-clamp-2"}`}>
            {post.subtitulo}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-3 text-[11px] text-[#aaa]">
          <span>{formatBlogDate(post.created_at)}</span>
          <span>·</span>
          <span>{readMin} min de lectura</span>
        </div>
        <Link
          href={`/blog/${post.slug}`}
          className="mt-3 inline-block text-[12px] font-semibold no-underline"
          style={{ color }}
        >
          Leer más →
        </Link>
      </div>
    </article>
  );
}

export default async function BlogPage({ searchParams }) {
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
  const showFeatured = featured && page === 1;

  function filterHref(cat, pg = 1) {
    const params = new URLSearchParams();
    if (cat && cat !== "todos") params.set("categoria", cat);
    if (pg > 1) params.set("page", String(pg));
    const q = params.toString();
    return q ? `/blog?${q}` : "/blog";
  }

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: WARM, color: "#1a1a1a" }}>
      <Navbar />

      <section className="border-b px-6 py-10" style={{ borderColor: BORDER, backgroundColor: WARM }}>
        <div className="mx-auto max-w-5xl text-center">
          <h1
            className="text-[32px] text-[#1a1a1a]"
            style={{ fontFamily: SERIF, fontWeight: 400 }}
          >
            Blog Home&Heart
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[#666]">
            Consejos para familias viajeras
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-wrap justify-center gap-2">
          {BLOG_CATEGORIAS.map((cat) => {
            const active = categoria === cat.id;
            const color =
              cat.id === "todos" ? "#1d4f91" : CATEGORIA_COLORS[cat.id] || "#888";
            return (
              <Link
                key={cat.id}
                href={filterHref(cat.id)}
                className="rounded-full border px-4 py-1.5 text-[12px] font-medium no-underline transition-colors"
                style={{
                  borderColor: active ? color : BORDER,
                  backgroundColor: active ? `${color}18` : "#fff",
                  color: active ? color : "#666",
                }}
              >
                {cat.label}
              </Link>
            );
          })}
        </div>

        {showFeatured && (
          <div className="mt-8">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#888]">
              Destacado
            </p>
            <BlogCard post={featured} large />
          </div>
        )}

        {posts.length === 0 && !showFeatured ? (
          <p className="mt-12 text-center text-sm text-[#888]">
            No hay artículos publicados todavía. Vuelve pronto.
          </p>
        ) : (
          <div className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${showFeatured ? "mt-8" : "mt-8"}`}>
            {posts.map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav
            className="mt-10 flex items-center justify-center gap-2"
            aria-label="Paginación"
          >
            {page > 1 && (
              <Link
                href={filterHref(categoria, page - 1)}
                className="rounded-lg border px-4 py-2 text-[12px] font-medium no-underline"
                style={{ borderColor: BORDER, color: "#666" }}
              >
                ← Anterior
              </Link>
            )}
            <span className="px-3 text-[12px] text-[#888]">
              Página {page} de {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={filterHref(categoria, page + 1)}
                className="rounded-lg border px-4 py-2 text-[12px] font-medium no-underline"
                style={{ borderColor: BORDER, color: "#666" }}
              >
                Siguiente →
              </Link>
            )}
          </nav>
        )}
      </main>
    </div>
  );
}
