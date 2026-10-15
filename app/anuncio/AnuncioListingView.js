import Link from "next/link";
import { AnuncioBackLink, AnuncioHeading } from "@/app/anuncio/AnuncioHeading";
import AnuncioBookingPanel from "@/app/components/AnuncioBookingPanel";
import AnuncioPreviewBanner from "@/app/components/AnuncioPreviewBanner";
import AnuncioProveedorBlock from "@/app/components/AnuncioProveedorBlock";
import ServicePhotoGalleryHero from "@/app/components/ServicePhotoGalleryHero";
import ServiceAnuncioContent from "@/app/components/ServiceAnuncioContent";
import { SERIF } from "@/app/components/brand";
import {
  getVerticalColor,
  VERTICAL_DOC_LABELS,
} from "@/app/lib/provider-verticals";
import {
  buildCalendarioServiceEntry,
} from "@/app/lib/public-service";
import {
  getServiceCardTheme,
  getServicePhotos,
  normalizeServiceProfile,
} from "@/app/lib/service-card-display";

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
  const titulo =
    service.titulo?.trim() ||
    theme.label ||
    VERTICAL_DOC_LABELS[service.vertical] ||
    "Servicio";

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
          <AnuncioBackLink />
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
        <AnuncioHeading service={service} profile={profile} accent={accent} />

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
