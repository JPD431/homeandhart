import { resolveAmenities } from "@/app/lib/amenities";
import { getCapacidadDisplayRows, formatCapacidadDisplayRow } from "@/app/lib/capacidad";
import {
  getServiceCardTheme,
  getServiceDescription,
  getServicePhotos,
} from "@/app/lib/service-card-display";

function ServicePhotoGallery({ photos, vertical, className = "", hero = false }) {
  const theme = getServiceCardTheme(vertical);

  if (!photos?.length) {
    return (
      <div
        className={`overflow-hidden ${hero ? "rounded-none" : "rounded-lg"} ${className}`}
        style={{
          background: theme.gradient,
          minHeight: hero ? 280 : 180,
        }}
        aria-hidden
      />
    );
  }

  if (photos.length === 1) {
    return (
      <div
        className={`overflow-hidden ${hero ? "rounded-none" : "rounded-lg"} ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[0]}
          alt=""
          className={
            hero
              ? "h-full max-h-[min(480px,55vh)] w-full object-cover"
              : "h-full max-h-[320px] w-full object-cover"
          }
        />
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${className}`}
    >
      {photos.map((url, index) => (
        <div
          key={`${url}-${index}`}
          className="overflow-hidden rounded-lg"
          style={{ aspectRatio: "4/3" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
}

/**
 * Contenido del anuncio visible al cliente: galería, descripción, capacidad, amenities.
 *
 * @param {object} props
 * @param {object} props.service
 * @param {string} [props.descripcion] — texto ya resuelto (p. ej. traducción)
 * @param {boolean} [props.showCapacidad]
 * @param {boolean} [props.showAmenities]
 */
export default function ServiceAnuncioContent({
  service,
  descripcion,
  showCapacidad = true,
  showAmenities = true,
  showGallery = true,
}) {
  if (!service) return null;

  const vertical = service.vertical || "alojamiento";
  const photos = getServicePhotos(service);
  const descriptionText =
    typeof descripcion === "string" ? descripcion : getServiceDescription(service);
  const capacidadRows =
    showCapacidad && vertical === "alojamiento"
      ? getCapacidadDisplayRows(service)
      : [];
  const amenityItems =
    showAmenities && vertical === "alojamiento"
      ? resolveAmenities(
          Array.isArray(service.amenities) ? service.amenities : [],
        )
      : [];

  return (
    <div className="mt-4 flex flex-col gap-4">
      {showGallery ? (
        <ServicePhotoGallery photos={photos} vertical={vertical} />
      ) : null}

      {descriptionText ? (
        <p className="text-[12px] leading-relaxed text-[#666] whitespace-pre-line">
          {descriptionText}
        </p>
      ) : null}

      {capacidadRows.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#888]">
            Capacidad
          </p>
          <div className="flex flex-wrap gap-2">
            {capacidadRows.map((row) => (
              <span
                key={`${row.label}-${row.value}`}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]"
                style={{ borderColor: "#e8e4de", backgroundColor: "#fafaf9" }}
              >
                <span aria-hidden>{row.icon}</span>
                <span className="text-[#444]">
                  {formatCapacidadDisplayRow(row)}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {amenityItems.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#888]">
            Comodidades
          </p>
          <div className="flex flex-wrap gap-2">
            {amenityItems.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]"
                style={{ borderColor: "#e8e4de", backgroundColor: "#fff" }}
              >
                <span aria-hidden>{item.icon}</span>
                <span className="text-[#444]">{item.label}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { ServicePhotoGallery };
