"use client";

import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import { SERIF } from "@/app/components/brand";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { CATEGORIA_COLORS, formatBlogDate } from "@/app/lib/blog-seed";

/*
 * Interfaz del artículo. La página (/blog/[slug]) es ISR en servidor: carga el
 * artículo y convierte el markdown; el idioma se resuelve aquí, en cliente.
 * El texto del artículo viene de la base de datos (en español).
 */

const BORDER = "#e8e4de";
const WARM = "#f7f5f2";
const PRIMARY = "#1d4f91";

export default function BlogArticleView({
  post,
  readMin,
  relacionados,
  htmlContent,
  heroImage,
  buscarHref,
}) {
  const { lang } = useLang();
  const t = useTranslation(lang);

  const color = CATEGORIA_COLORS[post.categoria] || PRIMARY;
  const categoriaNombre = t.blog.categorias[post.categoria] || post.categoria;

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: WARM, color: "#1a1a1a" }}>
      <Navbar />

      <header className="border-b" style={{ borderColor: BORDER, backgroundColor: WARM }}>
        <div className="relative mx-auto max-w-5xl">
          <div className="relative h-48 w-full overflow-hidden sm:h-64">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImage}
              alt={post.titulo}
              className="h-full w-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,.45), transparent)" }}
              aria-hidden
            />
          </div>
          <div className="relative mx-auto max-w-3xl px-6 pb-8 pt-6">
            <span
              className="inline-block rounded-full px-3 py-1 text-[11px] font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              {categoriaNombre}
            </span>
            <h1
              className="mt-4 text-3xl text-[#1a1a1a] sm:text-4xl"
              style={{ fontFamily: SERIF, fontWeight: 300 }}
            >
              {post.titulo}
            </h1>
            {post.subtitulo && (
              <p className="mt-3 text-base leading-relaxed text-[#666]">{post.subtitulo}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-3 text-[12px] text-[#888]">
              <span>{post.autor || "Home&Heart"}</span>
              <span>·</span>
              <span>{formatBlogDate(post.created_at, lang)}</span>
              <span>·</span>
              <span>
                {readMin} {t.blog.minLectura}
              </span>
            </div>
            {t.blog.soloEspanol && (
              <p className="mt-3 text-[12px] text-[#888]">{t.blog.soloEspanol}</p>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
          <article
            className="blog-prose min-w-0 rounded-xl border bg-white p-6 sm:p-8"
            style={{ borderColor: BORDER }}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />

          <aside className="flex flex-col gap-6">
            <div
              className="rounded-xl border bg-white p-5"
              style={{ borderColor: BORDER }}
            >
              <h2 className="text-sm font-semibold text-[#1a1a1a]">{t.blog.relacionados}</h2>
              {(relacionados ?? []).length === 0 ? (
                <p className="mt-3 text-[12px] text-[#888]">{t.blog.sinRelacionados}</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-3">
                  {(relacionados ?? []).map((rel) => (
                    <li key={rel.slug}>
                      <Link
                        href={`/blog/${rel.slug}`}
                        className="text-[12px] font-medium leading-snug no-underline hover:underline"
                        style={{ color: PRIMARY }}
                      >
                        {rel.titulo}
                      </Link>
                      <p className="text-[10px] text-[#aaa]">
                        {formatBlogDate(rel.created_at, lang)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div
              className="rounded-xl border p-5 text-center"
              style={{ borderColor: BORDER, backgroundColor: "#e8f0fb" }}
            >
              <p className="text-sm font-semibold text-[#1a1a1a]">{t.blog.necesitasProveedor}</p>
              <p className="mt-1 text-[12px] text-[#666]">{t.blog.encuentraPerfiles}</p>
              <Link
                href="/buscar"
                className="mt-4 inline-block rounded-lg px-4 py-2 text-[12px] font-semibold text-white no-underline"
                style={{ backgroundColor: PRIMARY }}
              >
                {t.blog.buscarProveedores}
              </Link>
            </div>
          </aside>
        </div>

        <section
          className="mt-12 rounded-2xl px-6 py-10 text-center"
          style={{ backgroundColor: color, color: "#fff" }}
        >
          <h2
            className="text-2xl sm:text-3xl"
            style={{ fontFamily: SERIF, fontWeight: 300 }}
          >
            {t.blog.buscasEn.replace("{categoria}", categoriaNombre.toLowerCase())}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm opacity-90">{t.blog.pagoProtegido}</p>
          <Link
            href={buscarHref}
            className="mt-6 inline-block rounded-lg bg-white px-6 py-3 text-sm font-semibold no-underline"
            style={{ color }}
          >
            {t.blog.buscarAhora}
          </Link>
        </section>
      </div>

      <style>{`
        .blog-prose h2 { font-size: 1.25rem; font-weight: 600; margin: 1.75rem 0 0.75rem; color: #1a1a1a; }
        .blog-prose h3 { font-size: 1.05rem; font-weight: 600; margin: 1.25rem 0 0.5rem; color: #333; }
        .blog-prose p { font-size: 0.9375rem; line-height: 1.75; color: #444; margin: 0 0 1rem; }
        .blog-prose ul, .blog-prose ol { margin: 0 0 1rem 1.25rem; font-size: 0.9375rem; line-height: 1.7; color: #444; }
        .blog-prose li { margin-bottom: 0.35rem; }
        .blog-prose a { color: ${PRIMARY}; font-weight: 500; }
        .blog-prose strong { color: #1a1a1a; }
      `}</style>
    </div>
  );
}
