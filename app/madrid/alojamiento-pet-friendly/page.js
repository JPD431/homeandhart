import { fetchMadridProviders, SeoLandingPage } from "../seo-landing-shared";

export const metadata = {
  title: "Alojamiento pet-friendly en Madrid · NRU verificado · Home&Heart",
  description:
    "Apartamentos y casas pet-friendly en Madrid con NRU registrado. Check-in flexible, reserva inmediata.",
};

const FAQ = [
  {
    q: "¿Qué significa pet-friendly en Home&Heart?",
    a: "Los anfitriones indican explícitamente si aceptan mascotas y bajo qué condiciones en su perfil y normas de la casa.",
  },
  {
    q: "¿El NRU está verificado?",
    a: "Los alojamientos en Madrid deben registrar su NRU. Lo comprobamos antes de activar el servicio.",
  },
  {
    q: "¿Puedo reservar con antelación corta?",
    a: "Muchos anfitriones ofrecen reserva inmediata. Filtra por disponibilidad y fechas en la búsqueda.",
  },
  {
    q: "¿Incluye la Garantía Home&Heart?",
    a: "Sí, en reservas elegibles. Si el anfitrión cancela con menos de 24 h, buscamos alternativa verificada.",
  },
];

export default async function AlojamientoPetFriendlyMadridPage() {
  const providers = await fetchMadridProviders("alojamiento");

  return (
    <SeoLandingPage
      h1="Alojamiento pet-friendly en Madrid"
      description="Apartamentos y casas que aceptan mascotas en Madrid, con NRU verificado y anfitriones evaluados. Reserva con check-in flexible y pago protegido en un solo lugar."
      vertical="alojamiento"
      buscarHref="/buscar?ciudad=Madrid&vertical=alojamiento"
      faq={FAQ}
      providers={providers}
      priceSuffix="/noche"
    />
  );
}
