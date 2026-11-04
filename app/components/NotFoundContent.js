"use client";

import Link from "@/app/components/LocaleLink";
import Footer from "@/app/components/Footer";
import Navbar from "@/app/components/Navbar";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";

const PRIMARY = "#1d4f91";
const WARM = "#f7f5f2";
const BORDER = "#e8e4de";
const SERIF = 'Georgia, "Times New Roman", Times, serif';

/** 404 con marca Home&Heart, cabecera y pie (notFound() desde proveedor, blog, anuncio, etc.). */
export default function NotFoundContent() {
  const { lang } = useLang();
  const e = useTranslation(lang).errores;

  return (
    <>
      <Navbar />
      <main
        id="contenido"
        tabIndex={-1}
        className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center outline-none"
        style={{ backgroundColor: WARM, color: "#1a1a1a" }}
      >
        <p
          className="text-[22px] leading-none"
          style={{ fontFamily: SERIF, fontWeight: 600 }}
        >
          Home
          <span style={{ fontStyle: "italic", color: PRIMARY }}>&</span>
          Heart
        </p>
        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-[#6b6b6b]">
          {e.codigo404}
        </p>
        <h1
          className="mt-2 max-w-md text-[22px] font-normal leading-snug"
          style={{ fontFamily: SERIF }}
        >
          {e.titulo404}
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#666]">
          {e.texto404}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/buscar"
            className="inline-flex min-h-[44px] items-center rounded-xl px-5 text-sm font-semibold text-white no-underline"
            style={{ backgroundColor: PRIMARY }}
          >
            {e.buscarServicios}
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center rounded-xl border px-5 text-sm font-semibold no-underline"
            style={{ borderColor: BORDER, color: PRIMARY }}
          >
            {e.irInicio}
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
