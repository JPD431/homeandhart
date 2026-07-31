import Link from "next/link";

const PRIMARY = "#1d4f91";
const WARM = "#f7f5f2";
const BORDER = "#e8e4de";
const SERIF = 'Georgia, "Times New Roman", Times, serif';

/**
 * 404 con marca Home&Heart (notFound() desde proveedor, blog, anuncio, etc.).
 */
export default function NotFound() {
  return (
    <div
      className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-16 text-center"
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
      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-[#aaa]">
        Error 404
      </p>
      <h1
        className="mt-2 max-w-md text-[22px] font-normal leading-snug"
        style={{ fontFamily: SERIF }}
      >
        Esta página no existe
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#666]">
        Puede que el enlace esté mal o que el contenido ya no esté disponible.
        Te ayudamos a encontrar lo que buscas.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/buscar"
          className="inline-flex min-h-[44px] items-center rounded-xl px-5 text-sm font-semibold text-white no-underline"
          style={{ backgroundColor: PRIMARY }}
        >
          Buscar servicios
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center rounded-xl border px-5 text-sm font-semibold no-underline"
          style={{ borderColor: BORDER, color: PRIMARY }}
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
