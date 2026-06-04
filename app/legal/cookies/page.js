import LegalPageLayout from "@/app/components/LegalPageLayout";

const PLACEHOLDER =
  "Este apartado se completará con el texto legal definitivo. El contenido actual es un marcador de posición con fines informativos.";

const sections = [
  { title: "¿Qué son las cookies?", body: PLACEHOLDER },
  { title: "Tipos de cookies que usamos", body: PLACEHOLDER },
  { title: "Cómo gestionar las cookies", body: PLACEHOLDER },
  { title: "Cookies de terceros", body: PLACEHOLDER },
];

export const metadata = {
  title: "Política de cookies · Home&Heart",
};

export default function CookiesPage() {
  return (
    <LegalPageLayout title="Política de cookies" sections={sections} />
  );
}
