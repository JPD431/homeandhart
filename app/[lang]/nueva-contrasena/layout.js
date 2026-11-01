import { resolveLang, staticPageMetadata } from "@/app/lib/seo";

export async function generateMetadata({ params }) {
  return staticPageMetadata("nuevaContrasena", "/nueva-contrasena", await resolveLang(params), { noindex: true });
}

export default function NuevaContrasenaLayout({ children }) {
  return children;
}
