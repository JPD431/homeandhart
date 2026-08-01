import { notFound, redirect } from "next/navigation";
import AnuncioListingView, {
  buildAnuncioMetadata,
} from "@/app/anuncio/AnuncioListingView";
import { loadProveedorRating } from "@/app/lib/reviews";
import {
  loadAnuncioService,
  loadServiceBloqueos,
} from "@/app/lib/public-service";
import { createClient } from "@/lib/supabase/server";

/**
 * Vista previa dueño/admin — necesita sesión (cookies).
 * Separada del anuncio público ISR para evitar DYNAMIC_SERVER_USAGE.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { serviceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      title: "Vista previa · Home&Heart",
      robots: { index: false, follow: false },
    };
  }

  const { service, mode } = await loadAnuncioService(serviceId, {
    previewRequested: true,
    userId: user.id,
    supabase,
  });

  return buildAnuncioMetadata({ service, mode });
}

export default async function AnuncioPreviewPage({ params }) {
  const { serviceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/anuncio/${serviceId}/preview`)}`,
    );
  }

  const { service, mode } = await loadAnuncioService(serviceId, {
    previewRequested: true,
    userId: user.id,
    supabase,
  });

  if (!service) {
    notFound();
  }

  const isOwnerPreview =
    mode === "owner-preview" || mode === "admin-preview";

  const [bloqueosCalendario, proveedorRating] = await Promise.all([
    loadServiceBloqueos(serviceId),
    loadProveedorRating(service.proveedor_id),
  ]);

  return (
    <AnuncioListingView
      service={service}
      proveedorRating={proveedorRating}
      bloqueosCalendario={bloqueosCalendario}
      isOwnerPreview={isOwnerPreview}
    />
  );
}
