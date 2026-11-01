// TODO(LEGAL): texto provisional. Debe redactarlo un abogado antes de publicar.
// Fecha/versión: ver LEGAL_DOCS_VERSION en app/lib/legal-versions.js.
import LegalPageLayout from "@/app/components/LegalPageLayout";
import { resolveLang, staticPageMetadata } from "@/app/lib/seo";

const PLACEHOLDER =
  "Este apartado se completará con el texto legal definitivo. El contenido actual es un marcador de posición con fines informativos.";

const sections = [
  { title: "Objeto y ámbito", body: PLACEHOLDER },
  { title: "Registro y cuenta", body: PLACEHOLDER },
  { title: "Servicios ofrecidos", body: PLACEHOLDER },
  { title: "Obligaciones del cliente", body: PLACEHOLDER },
  { title: "Obligaciones del proveedor", body: PLACEHOLDER },
  { title: "Comisiones y pagos", body: PLACEHOLDER },
  { title: "Cancelaciones y reembolsos", body: PLACEHOLDER },
  { title: "Responsabilidad", body: PLACEHOLDER },
  { title: "Propiedad intelectual", body: PLACEHOLDER },
  { title: "Protección de datos", body: PLACEHOLDER },
  { title: "Ley aplicable", body: PLACEHOLDER },
];

export async function generateMetadata({ params }) {
  return staticPageMetadata("terminos", "/legal/terminos", await resolveLang(params));
}

export default function TerminosPage() {
  return (
    <LegalPageLayout title="Términos de uso" sections={sections} />
  );
}
