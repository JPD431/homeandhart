import { fetchMadridProviders, SeoLandingPage } from "../seo-landing-shared";

export const metadata = {
  title: "Cuidadores de mascotas en Madrid · Verificados · Home&Heart",
  description:
    "Cuidadores de mascotas verificados en Madrid. Paseos incluidos, fotos y actualizaciones. Reserva online con garantía.",
};

const FAQ = [
  {
    q: "¿Qué servicios incluye el cuidado de mascotas?",
    a: "Paseos, visitas a domicilio, cuidado en casa del cuidador o del cliente. Cada perfil detalla qué ofrece.",
  },
  {
    q: "¿Recibo fotos y actualizaciones?",
    a: "Los cuidadores verificados pueden enviarte actualizaciones durante el servicio a través de la plataforma.",
  },
  {
    q: "¿Cómo se verifican los cuidadores?",
    a: "Identidad, referencias y documentación según el tipo de servicio. Solo publicamos perfiles que superan el proceso.",
  },
  {
    q: "¿Hay garantía si algo sale mal?",
    a: "La Garantía Home&Heart cubre cancelaciones de última hora con alternativas verificadas en 30 minutos.",
  },
];

export default async function CuidadorMascotasMadridPage() {
  const providers = await fetchMadridProviders("mascotas");

  return (
    <SeoLandingPage
      h1="Cuidadores de mascotas en Madrid verificados"
      description="Encuentra cuidadores de perros y gatos en Madrid con paseos, visitas y estancias. Perfiles verificados, reserva online y pago protegido con la Garantía Home&Heart."
      vertical="mascotas"
      buscarHref="/buscar?ciudad=Madrid&vertical=mascotas"
      faq={FAQ}
      providers={providers}
      priceSuffix="/día"
    />
  );
}
