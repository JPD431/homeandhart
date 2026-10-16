import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ lang: "es" }));

vi.mock("@/app/lib/LangContext", () => ({
  useLang: () => ({ lang: state.lang }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push() {}, refresh() {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/lib/supabase", () => ({ supabase: {} }));

import { AnuncioBackLink, AnuncioHeading } from "@/app/anuncio/AnuncioHeading";
import AnuncioPreviewBanner from "@/app/components/AnuncioPreviewBanner";
import AnuncioProveedorBlock from "@/app/components/AnuncioProveedorBlock";
import CalendarioDisponibilidad from "@/app/components/CalendarioDisponibilidad";
import ServiceAnuncioContent from "@/app/components/ServiceAnuncioContent";

const render = (component, props) =>
  renderToStaticMarkup(createElement(component, props));

const alojamiento = {
  id: "s1",
  vertical: "alojamiento",
  titulo: "Piso en Sevilla",
  ciudad: "Sevilla",
  reserva_inmediata: true,
  cancellation_policy: "flexible",
  descripcion: "Un piso luminoso",
  capacidad: { personas: 2, habitaciones: 1, camas: 1, banos: 1, bano_tipo: "privado" },
  capacidad_maxima: 4,
  huespedes_incluidos: 2,
  precio_huesped_extra: 10,
  amenities: ["wifi", "cocina", "piscina"],
};

beforeEach(() => {
  state.lang = "es";
});

describe("AnuncioHeading / AnuncioBackLink", () => {
  it("español", () => {
    const html = render(AnuncioHeading, {
      service: alojamiento,
      profile: { verificado: true },
      accent: "#1d4f91",
    });
    expect(html).toContain("🏠 Alojamiento");
    expect(html).toContain("Piso en Sevilla");
    expect(html).toContain("Reserva inmediata");
    expect(html).toContain("Verificado");
    expect(html).toContain("Cancelación flexible");
    expect(render(AnuncioBackLink)).toContain("Volver a la búsqueda");
  });

  it("inglés", () => {
    state.lang = "en";
    const html = render(AnuncioHeading, {
      service: alojamiento,
      profile: { verificado: true },
      accent: "#1d4f91",
    });
    expect(html).toContain("Accommodation");
    expect(html).toContain("Instant booking");
    expect(html).toContain("Verified");
    expect(html).toContain("Flexible cancellation");
    expect(html).not.toContain("Reserva inmediata");
    expect(render(AnuncioBackLink)).toContain("Back to search");
  });

  it("zona y título de reserva sin datos", () => {
    state.lang = "en";
    const html = render(AnuncioHeading, {
      service: { vertical: "ninos" },
      profile: {},
      accent: "#0e7a5c",
    });
    expect(html).toContain("Childcare");
    expect(html).toContain("Area");
  });
});

describe("ServiceAnuncioContent", () => {
  it("español", () => {
    const html = render(ServiceAnuncioContent, { service: alojamiento });
    expect(html).toContain("Capacidad");
    expect(html).toContain("2 personas");
    expect(html).toContain("Baño privado");
    expect(html).toContain("Comodidades");
    expect(html).toContain("Cocina equipada");
    expect(html).toContain("Hasta 4 huéspedes");
  });

  it("inglés", () => {
    state.lang = "en";
    const html = render(ServiceAnuncioContent, { service: alojamiento });
    expect(html).toContain("Capacity");
    expect(html).toContain("2 people");
    expect(html).toContain("Private bathroom");
    expect(html).toContain("Amenities");
    expect(html).toContain("Equipped kitchen");
    expect(html).toContain("Kitchen &amp; dining");
    expect(html).toContain("Up to 4 guests");
    expect(html).toContain("per extra guest");
    expect(html).not.toContain("Comodidades");
  });

  it("mascotas en inglés", () => {
    state.lang = "en";
    const html = render(ServiceAnuncioContent, {
      service: { vertical: "mascotas", jardin: true, paseos_incluidos: true },
    });
    expect(html).toContain("Has a garden");
    expect(html).toContain("Walks included");
  });
});

describe("AnuncioProveedorBlock", () => {
  const props = {
    profile: { nombre: "Ana", apellido: "López", descripcion: "Hola" },
    proveedorId: "p1",
    rating: { count: 3, avg: 4.5 },
  };

  it("español", () => {
    const html = render(AnuncioProveedorBlock, props);
    expect(html).toContain("Tu proveedor");
    expect(html).toContain("3 reseñas");
    expect(html).toContain("Contactar");
    expect(html).toContain("Ver perfil completo");
  });

  it("inglés, con singular y sin valoraciones", () => {
    state.lang = "en";
    const html = render(AnuncioProveedorBlock, props);
    expect(html).toContain("Your host");
    expect(html).toContain("3 reviews");
    expect(html).toContain("Contact");
    expect(html).toContain("View full profile");
    expect(
      render(AnuncioProveedorBlock, { ...props, rating: { count: 1, avg: 5 } }),
    ).toContain("1 review<");
    expect(
      render(AnuncioProveedorBlock, { ...props, rating: { count: 0, avg: null } }),
    ).toContain("No reviews yet");
  });
});

describe("AnuncioPreviewBanner", () => {
  it("se traduce", () => {
    expect(render(AnuncioPreviewBanner)).toContain("Vista previa");
    state.lang = "en";
    const html = render(AnuncioPreviewBanner);
    expect(html).toContain("Preview");
    expect(html).toContain("isn&#x27;t published yet");
  });
});

describe("CalendarioDisponibilidad", () => {
  const props = {
    services: [{ id: "s1", titulo: "Piso", dias_disponibles: ["lun", "mar"] }],
    bloqueos: [],
    embedded: true,
    singleMonth: true,
    showReservaLink: false,
  };

  it("español", () => {
    const html = render(CalendarioDisponibilidad, props);
    expect(html).toContain("Elige tus fechas");
    expect(html).toContain("Lun");
    expect(html).toContain("Disponible");
    expect(html).toContain("Ocupado");
  });

  it("inglés", () => {
    state.lang = "en";
    const html = render(CalendarioDisponibilidad, props);
    expect(html).toContain("Choose your dates");
    expect(html).toContain("Mon");
    expect(html).toContain("Available");
    expect(html).toContain("Booked");
    expect(html).not.toContain("Ocupado");
  });
});
