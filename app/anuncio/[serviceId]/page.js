import { notFound, redirect } from "next/navigation";
import AnuncioListingView, {
  buildAnuncioMetadata,
} from "@/app/anuncio/AnuncioListingView";
import { loadProveedorRating } from "@/app/lib/reviews";
import {
  loadPublicServiceById,
  loadServiceBloqueos,
} from "@/app/lib/public-service";

/**
 * Anuncio PÚBLICO — ISR (sin cookies / sin auth.getUser).
 * Vista previa del dueño: /anuncio/[serviceId]/preview (force-dynamic).
 */
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const { serviceId } = await params;
  const service = await loadPublicServiceById(serviceId);
  return buildAnuncioMetadata({ service, mode: service ? "public" : null });
}

export default async function AnuncioPage({ params, searchParams }) {
  try {
    const { serviceId } = await params;
    const sp = await searchParams;

    // Compat: ?preview=1 → ruta dinámica con sesión.
    if (sp?.preview === "1") {
      redirect(`/anuncio/${serviceId}/preview`);
    }

    const initialDesde = typeof sp?.desde === "string" ? sp.desde : "";
    const initialHasta = typeof sp?.hasta === "string" ? sp.hasta : "";

    // Solo carga pública — no createClient / getUser (compatible con ISR).
    const service = await loadPublicServiceById(serviceId);
    if (!service) {
      notFound();
    }

    const [bloqueosCalendario, proveedorRating] = await Promise.all([
      loadServiceBloqueos(serviceId),
      loadProveedorRating(service.proveedor_id),
    ]);

    return (
      <AnuncioListingView
        service={service}
        proveedorRating={proveedorRating}
        bloqueosCalendario={bloqueosCalendario}
        isOwnerPreview={false}
        initialDesde={initialDesde}
        initialHasta={initialHasta}
      />
    );
  } catch (err) {
    const digest = typeof err?.digest === "string" ? err.digest : "";
    if (digest.startsWith("NEXT_")) {
      throw err;
    }
    console.error("[anuncio] render error:", err);
    console.error("[anuncio] render error detail:", {
      message: err?.message,
      stack: err?.stack,
      digest: err?.digest,
      name: err?.name,
      cause: err?.cause,
    });
    throw err;
  }
}
