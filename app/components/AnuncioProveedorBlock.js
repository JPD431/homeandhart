import Link from "next/link";
import ProveedorPreguntarButton from "@/app/components/ProveedorPreguntarButton";
import { SERIF } from "@/app/components/brand";
import { formatProveedorRatingAvg } from "@/app/lib/reviews";
import {
  getServiceCardInitials,
  getServiceCardTheme,
} from "@/app/lib/service-card-display";

const STAR_COLOR = "#c47d1a";

function truncateBio(text, maxLength = 200) {
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) return "";
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
}

function formatProviderFullName(nombre, apellido) {
  return [nombre?.trim(), apellido?.trim()].filter(Boolean).join(" ");
}

/**
 * Bloque "Tu proveedor" en la columna izquierda de /anuncio/[serviceId].
 *
 * @param {object} props
 * @param {object} props.profile — profiles_public
 * @param {string} props.proveedorId
 * @param {{ sum: number, count: number, avg: number|null }} props.rating
 * @param {string} [props.accentColor]
 * @param {string} [props.vertical]
 */
export default function AnuncioProveedorBlock({
  profile,
  proveedorId,
  rating,
  accentColor = "#1d4f91",
  vertical = "alojamiento",
}) {
  if (!profile || !proveedorId) return null;

  const theme = getServiceCardTheme(vertical);
  const fullName = formatProviderFullName(profile.nombre, profile.apellido);
  const initials = getServiceCardInitials(profile.nombre, profile.apellido);
  const avatarUrl = profile.foto_perfil || profile.foto_url || null;
  const bio = truncateBio(profile.descripcion);
  const valoracionMedia = formatProveedorRatingAvg(rating);
  const numReviews = rating?.count ?? 0;

  return (
    <section
      className="mt-8 border-t pt-8"
      style={{ borderColor: "#f0ede8" }}
      aria-labelledby="anuncio-proveedor-heading"
    >
      <h2
        id="anuncio-proveedor-heading"
        className="text-[13px] font-semibold uppercase tracking-wide text-[#888]"
        style={{ fontFamily: SERIF }}
      >
        Tu proveedor
      </h2>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={fullName || "Proveedor"}
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white"
            style={{ backgroundColor: accentColor || theme.color }}
          >
            {initials}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p
            className="text-[17px] text-[#111]"
            style={{ fontFamily: SERIF, fontWeight: 400 }}
          >
            {fullName || "Proveedor"}
          </p>

          {valoracionMedia ? (
            <p className="mt-1 text-[12px]" style={{ color: STAR_COLOR }}>
              ★ {valoracionMedia}
              <span className="text-[#888]">
                {" "}
                · {numReviews} reseña{numReviews !== 1 ? "s" : ""}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-[#aaa]">Aún sin valoraciones</p>
          )}

          {bio ? (
            <p className="mt-3 text-[13px] leading-relaxed text-[#555]">{bio}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ProveedorPreguntarButton
          proveedorId={proveedorId}
          className="rounded-lg px-5 py-2.5 text-[13px] font-semibold transition-colors hover:opacity-90 sm:w-auto"
          style={{
            backgroundColor: accentColor || theme.color,
            color: "#fff",
          }}
        >
          Contactar
        </ProveedorPreguntarButton>

        <Link
          href={`/proveedor/${proveedorId}`}
          className="text-center text-[12px] font-medium no-underline transition-opacity hover:opacity-80 sm:text-left"
          style={{ color: accentColor || theme.color }}
        >
          Ver perfil completo →
        </Link>
      </div>
    </section>
  );
}
