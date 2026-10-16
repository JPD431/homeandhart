"use client";

import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import { SERIF } from "@/app/components/brand";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import {
  BLOG_CATEGORIAS,
  CATEGORIA_COLORS,
  formatBlogDate,
} from "@/app/lib/blog-seed";

/*
 * Interfaz del índice del blog. La página (/blog) es ISR en servidor y solo
 * carga los datos; el idioma se resuelve aquí, en cliente.
 * Los títulos y textos de los artículos vienen de la base de datos (en español).
 */

const BORDER = "#e8e4de";
const WARM = "#f7f5f2";

function getImageUrl(slug, width, height) {
  return `https://picsum.photos/seed/${slug}/${width}/${height}`;
}

function getPostImageUrl(post, width = 400, height = 200) {
  return post.imagen_url || getImageUrl(post.slug, width, height);
}

function BlogCard({ post, large = false }) {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const color = CATEGORIA_COLORS[post.categoria] || "#1d4f91";
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
          {t.blog.categorias[post.categoria] || post.categoria}
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
          <span>{formatBlogDate(post.created_at, lang)}</span>
          <span>·</span>
          <span>
            {post.readMin} {t.blog.minLectura}
          </span>
        </div>
        <Link
          href={`/blog/${post.slug}`}
          className="mt-3 inline-block text-[12px] font-semibold no-underline"
          style={{ color }}
        >
          {t.blog.leerMas}
        </Link>
      </div>
    </article>
  );
}

function filterHref(cat, pg = 1) {
  const params = new URLSearchParams();
  if (cat && cat !== "todos") params.set("categoria", cat);
  if (pg > 1) params.set("page", String(pg));
  const q = params.toString();
  return q ? `/blog?${q}` : "/blog";
}

export default function BlogIndexView({
  featured,
  posts,
  categoria,
  page,
  totalPages,
}) {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const showFeatured = featured && page === 1;

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: WARM, color: "#1a1a1a" }}>
      <Navbar />

      <section className="border-b px-6 py-10" style={{ borderColor: BORDER, backgroundColor: WARM }}>
        <div className="mx-auto max-w-5xl text-center">
          <h1
            className="text-[32px] text-[#1a1a1a]"
            style={{ fontFamily: SERIF, fontWeight: 400 }}
          >
            {t.blog.titulo}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[#666]">
            {t.blog.subtitulo}
          </p>
          {t.blog.soloEspanol && (
            <p className="mx-auto mt-3 max-w-xl text-[12px] text-[#888]">
              {t.blog.soloEspanol}
            </p>
          )}
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
                {t.blog.categorias[cat.id] || cat.label}
              </Link>
            );
          })}
        </div>

        {showFeatured && (
          <div className="mt-8">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#888]">
              {t.blog.destacado}
            </p>
            <BlogCard post={featured} large />
          </div>
        )}

        {posts.length === 0 && !showFeatured ? (
          <p className="mt-12 text-center text-sm text-[#888]">{t.blog.vacio}</p>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav
            className="mt-10 flex items-center justify-center gap-2"
            aria-label={t.blog.paginacion}
          >
            {page > 1 && (
              <Link
                href={filterHref(categoria, page - 1)}
                className="rounded-lg border px-4 py-2 text-[12px] font-medium no-underline"
                style={{ borderColor: BORDER, color: "#666" }}
              >
                {t.blog.anterior}
              </Link>
            )}
            <span className="px-3 text-[12px] text-[#888]">
              {t.blog.pagina
                .replace("{page}", String(page))
                .replace("{total}", String(totalPages))}
            </span>
            {page < totalPages && (
              <Link
                href={filterHref(categoria, page + 1)}
                className="rounded-lg border px-4 py-2 text-[12px] font-medium no-underline"
                style={{ borderColor: BORDER, color: "#666" }}
              >
                {t.blog.siguiente}
              </Link>
            )}
          </nav>
        )}
      </main>
    </div>
  );
}
