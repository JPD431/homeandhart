import LegalPageLayout from "@/app/components/LegalPageLayout";

const PLACEHOLDER =
  "Este apartado se completará con el texto legal definitivo. El contenido actual es un marcador de posición con fines informativos.";

const sections = [
  { title: "Datos identificativos", body: PLACEHOLDER },
  { title: "Actividad", body: PLACEHOLDER },
  { title: "Propiedad intelectual", body: PLACEHOLDER },
  { title: "Legislación aplicable", body: PLACEHOLDER },
];

export const metadata = {
  title: "Aviso legal · Home&Heart",
};

export default function AvisoLegalPage() {
  return <LegalPageLayout title="Aviso legal" sections={sections} />;
}
