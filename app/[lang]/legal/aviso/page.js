import LegalPageLayout from "@/app/components/LegalPageLayout";
import { resolveLang, staticPageMetadata } from "@/app/lib/seo";

const PLACEHOLDER =
  "Este apartado se completará con el texto legal definitivo. El contenido actual es un marcador de posición con fines informativos.";

const sections = [
  { title: "Datos identificativos", body: PLACEHOLDER },
  { title: "Actividad", body: PLACEHOLDER },
  { title: "Propiedad intelectual", body: PLACEHOLDER },
  { title: "Legislación aplicable", body: PLACEHOLDER },
];

export async function generateMetadata({ params }) {
  return staticPageMetadata("aviso", "/legal/aviso", await resolveLang(params));
}

export default function AvisoLegalPage() {
  return <LegalPageLayout title="Aviso legal" sections={sections} />;
}
