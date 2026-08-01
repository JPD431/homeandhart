import Link from "next/link";
import AnuncioBookingPanel from "@/app/components/AnuncioBookingPanel";
import AnuncioPreviewBanner from "@/app/components/AnuncioPreviewBanner";
import AnuncioProveedorBlock from "@/app/components/AnuncioProveedorBlock";
import ServicePhotoGalleryHero from "@/app/components/ServicePhotoGalleryHero";
import ServiceAnuncioContent from "@/app/components/ServiceAnuncioContent";
import { SERIF } from "@/app/components/brand";
import { normalizeCancelPolicy } from "@/app/lib/cancelacion-politica";
import {
  getVerticalColor,
  VERTICAL_DOC_LABELS,
} from "@/app/lib/provider-verticals";
import {
  buildCalendarioServiceEntry,
} from "@/app/lib/public-service";
import {
  getServiceCardTags,
  getServiceCardTheme,
  getServiceCardZone,
  getServicePhotos,
  normalizeServiceProfile,
} from "@/app/lib/service-card-display";

const CANCEL_LABELS = {
  flexible: "Cancelación flexible",
  moderada: "Cancelación moderada",
  estricta: "Cancelación estricta",
};

function Tag({ children, light, color }) {
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
      style={{ backgroundColor: light, color }}
    >
      {children}
    </span>
  );
}

function getListingTags(service, profile) {
  const tags = getServiceCardTags(service, profile, "es");
  const cancelKey = normalizeCancelPolicy(service.cancellation_policy);
  const cancelLabel = CANCEL_LABELS[cancelKey];
  if (cancelLabel) {
    tags.push({ text: cancelLabel, light: "#f7f5f2", color: "#888" });
  }
  return tags;
}

/**
 * UI compartida del anuncio (público ISR o vista previa dinámica).
 */
export default function AnuncioListingView({
  service,
  proveedorRating,
  bloqueosCalendario,
  isOwnerPreview = false,
}) {
  const profile = normalizeServiceProfile(service);
  const theme = getServiceCardTheme(service.vertical);
  const accent = getVerticalColor(service.vertical);
  const photos = getServicePhotos(service);
  const zone = getServiceCardZone(service, profile);
  const titulo =
    service.titulo?.trim() ||
    theme.label ||
    VERTICAL_DOC_LABELS[service.vertical] ||
    "Servicio";
  const tags = getListingTags(service, profile);

  const serviceCalendario = buildCalendarioServiceEntry(service, {
    titulo,
    label: VERTICAL_DOC_LABELS[service.vertical] || theme.label,
  });

  return (
    <div
      className="min-h-screen font-sans"
      style={{ backgroundColor: "#f7f5f2", color: "#1a1a1a" }}
    >
      {isOwnerPreview && <AnuncioPreviewBanner />}

      <header
        className="border-b"
        style={{ backgroundColor: "#f7f5f2", borderColor: "#e8e4de" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="shrink-0 no-underline">
            <p
              className="text-[18px] leading-none text-[#111]"
              style={{ fontFamily: SERIF }}
            >
              Home<span className="italic" style={{ color: accent }}>
                &
              </span>
              Heart
            </p>
          </Link>
          <Link
            href="/buscar"
            className="text-[12px] no-underline transition-opacity hover:opacity-80"
            style={{ color: "#666" }}
          >
            ← Volver a la búsqueda
          </Link>
        </div>
      </header>

      <div className="w-full" style={{ borderBottom: "1px solid #e8e4de" }}>
        <div className="mx-auto max-w-6xl">
          <ServicePhotoGalleryHero
            photos={photos}
            vertical={service.vertical}
            className="w-full"
          />
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <p
          className="text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: accent }}
        >
          {VERTICAL_DOC_LABELS[service.vertical] || theme.label}
        </p>

        <h1
          className="mt-2 text-[#111]"
          style={{
            fontFamily: SERIF,
            fontWeight: 300,
            fontSize: "clamp(24px, 4vw, 32px)",
            lineHeight: 1.2,
          }}
        >
          {titulo}
        </h1>

        <p className="mt-2 text-[13px] text-[#888]">{zone}</p>

        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Tag key={tag.text} light={tag.light} color={tag.color}>
                {tag.text}
              </Tag>
            ))}
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_minmax(300px,380px)]">
          <div
            className="rounded-xl border bg-white p-5 sm:p-6"
            style={{ borderColor: "#e8e4de" }}
          >
            <ServiceAnuncioContent service={service} showGallery={false} />
            <AnuncioProveedorBlock
              profile={profile}
              proveedorId={service.proveedor_id}
              rating={proveedorRating}
              accentColor={accent}
              vertical={service.vertical}
              isOwnerPreview={isOwnerPreview}
            />
          </div>

          <AnuncioBookingPanel
            service={service}
            serviceCalendario={serviceCalendario}
            bloqueos={bloqueosCalendario}
            accentColor={accent}
            isOwnerPreview={isOwnerPreview}
          />
        </div>
      </main>
    </div>
  );
}

/** Metadata helpers compartidos. */
export function buildAnuncioMetadata({ service, mode }) {
  if (!service) {
    return {
      title: "Anuncio no disponible",
      description: "Este anuncio no está disponible en Home&Heart.",
    };
  }

  const profile = normalizeServiceProfile(service);
  const titulo =
    service.titulo?.trim() ||
    VERTICAL_DOC_LABELS[service.vertical] ||
    "Servicio";
  const ciudad = service.ciudad || profile.ciudad || "";

  if (mode === "owner-preview" || mode === "admin-preview") {
    return {
      title: `Vista previa · ${titulo}`,
      description: "Vista previa de anuncio en Home&Heart.",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: ciudad ? `${titulo} · ${ciudad}` : titulo,
    description: `Anuncio verificado en Home&Heart${ciudad ? ` · ${ciudad}` : ""}.`,
  };
}
