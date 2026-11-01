import { resolveLang, staticPageMetadata } from "@/app/lib/seo";

export async function generateMetadata({ params }) {
  return staticPageMetadata("recuperar", "/recuperar-contrasena", await resolveLang(params), { noindex: true });
}

export default function RecuperarLayout({ children }) {
  return children;
}
