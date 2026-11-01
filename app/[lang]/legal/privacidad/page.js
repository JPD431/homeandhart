// TODO(LEGAL): texto provisional. Debe redactarlo un abogado antes de publicar.
// Fecha/versión: ver LEGAL_DOCS_VERSION en app/lib/legal-versions.js.
import LegalPageLayout from "@/app/components/LegalPageLayout";
import { resolveLang, staticPageMetadata } from "@/app/lib/seo";

const PLACEHOLDER =
  "Este apartado se completará con el texto legal definitivo. El contenido actual es un marcador de posición con fines informativos.";

const sections = [
  { title: "Responsable del tratamiento", body: PLACEHOLDER },
  { title: "Datos que recogemos", body: PLACEHOLDER },
  { title: "Finalidad del tratamiento", body: PLACEHOLDER },
  { title: "Base legal", body: PLACEHOLDER },
  { title: "Conservación de datos", body: PLACEHOLDER },
  { title: "Derechos del usuario", body: PLACEHOLDER },
  { title: "Cookies", body: PLACEHOLDER },
  { title: "Transferencias internacionales", body: PLACEHOLDER },
  { title: "Contacto", body: PLACEHOLDER },
];

export async function generateMetadata({ params }) {
  return staticPageMetadata("privacidad", "/legal/privacidad", await resolveLang(params));
}

export default function PrivacidadPage() {
  return (
    <LegalPageLayout title="Política de privacidad" sections={sections} />
  );
}
