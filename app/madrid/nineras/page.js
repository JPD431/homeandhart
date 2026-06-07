import { fetchMadridProviders, SeoLandingPage } from "../seo-landing-shared";

export const metadata = {
  title: "Niñeras en Madrid · Certificadas y verificadas · Home&Heart",
  description:
    "Encuentra niñeras certificadas en Madrid con antecedentes verificados. Disponibles por horas o días. Reserva online con pago protegido.",
};

const FAQ = [
  {
    q: "¿Las niñeras están verificadas?",
    a: "Sí. Todas pasan verificación de identidad y antecedentes penales antes de publicar su perfil en Home&Heart.",
  },
  {
    q: "¿Puedo reservar por horas o por días?",
    a: "Depende de cada niñera. Puedes filtrar por disponibilidad y ver el precio por hora en cada perfil.",
  },
  {
    q: "¿Cómo funciona el pago?",
    a: "Un solo pago protegido en la plataforma. No pagas hasta que la reserva queda confirmada.",
  },
  {
    q: "¿Qué pasa si la niñera cancela?",
    a: "Activa la Garantía Home&Heart: te proponemos alternativas verificadas en menos de 30 minutos.",
  },
];

export default async function NinerasMadridPage() {
  const providers = await fetchMadridProviders("ninos");

  return (
    <SeoLandingPage
      h1="Niñeras en Madrid certificadas y verificadas"
      description="Encuentra niñeras de confianza en Madrid con antecedentes verificados, referencias y reseñas reales. Reserva por horas o días con un solo pago protegido y la Garantía Home&Heart."
      vertical="ninos"
      buscarHref="/buscar?ciudad=Madrid&vertical=ninos"
      faq={FAQ}
      providers={providers}
      priceSuffix="/hora"
    />
  );
}
