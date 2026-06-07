import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { SERIF } from "@/app/components/brand";

const PRIMARY = "#1d4f91";
const BORDER = "#e8e4de";

export async function fetchMadridProviders(vertical) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const { data } = await supabase
    .from("services")
    .select(
      `
      id,
      titulo,
      vertical,
      precio,
      ciudad,
      proveedor_id,
      profiles!inner (
        id,
        nombre,
        apellido,
        verificado,
        ciudad
      )
    `,
    )
    .eq("disponible", true)
    .eq("vertical", vertical)
    .or("ciudad.ilike.%Madrid%,location_zone.ilike.%Madrid%");

  return data ?? [];
}

export function SeoLandingPage({
  h1,
  description,
  vertical,
  buscarHref,
  faq,
  providers,
  priceSuffix,
}) {
  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: "#f7f5f2" }}>
      <header
        className="border-b bg-white px-6 py-4"
        style={{ borderColor: BORDER }}
      >
        <Link
          href="/"
          className="no-underline"
          style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600 }}
        >
          Home<span style={{ fontStyle: "italic", color: PRIMARY }}>&</span>Heart
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1
          className="text-3xl text-[#1a1a1a] sm:text-4xl"
          style={{ fontFamily: SERIF, fontWeight: 300 }}
        >
          {h1}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#666]">
          {description}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={buscarHref}
            className="rounded-lg px-5 py-3 text-sm font-semibold text-white no-underline"
            style={{ backgroundColor: PRIMARY }}
          >
            Buscar proveedores →
          </Link>
          <Link
            href="/registro"
            className="rounded-lg border px-5 py-3 text-sm font-semibold no-underline"
            style={{ borderColor: PRIMARY, color: PRIMARY, backgroundColor: "#fff" }}
          >
            Registrarse gratis
          </Link>
        </div>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-[#1a1a1a]">
            Proveedores disponibles en Madrid
          </h2>
          {providers.length === 0 ? (
            <p className="mt-4 text-sm text-[#888]">
              Próximamente más proveedores en esta categoría.{" "}
              <Link href={buscarHref} style={{ color: PRIMARY }}>
                Explora todas las opciones
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {providers.map((service) => {
                const p = service.profiles;
                const nombre =
                  [p?.nombre, p?.apellido].filter(Boolean).join(" ") ||
                  "Proveedor";
                return (
                  <li key={service.id}>
                    <Link
                      href={`/proveedor/${service.proveedor_id}`}
                      className="block rounded-xl border bg-white p-4 no-underline transition-shadow hover:shadow-md"
                      style={{ borderColor: BORDER }}
                    >
                      <p className="font-semibold text-[#1a1a1a]">
                        {service.titulo || nombre}
                      </p>
                      <p className="mt-1 text-sm text-[#888]">{nombre}</p>
                      {service.precio != null && (
                        <p
                          className="mt-2 text-sm font-semibold"
                          style={{ color: PRIMARY }}
                        >
                          desde {Number(service.precio)}€{priceSuffix}
                        </p>
                      )}
                      {p?.verificado && (
                        <span className="mt-2 inline-block text-[10px] font-semibold text-[#0e7a5c]">
                          ✓ Verificado
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-[#1a1a1a]">
            Preguntas frecuentes
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {faq.map((item) => (
              <li
                key={item.q}
                className="rounded-xl border bg-white p-4"
                style={{ borderColor: BORDER }}
              >
                <p className="text-sm font-semibold text-[#1a1a1a]">{item.q}</p>
                <p className="mt-2 text-sm leading-relaxed text-[#666]">
                  {item.a}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
