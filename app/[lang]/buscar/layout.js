import { resolveLang, staticPageMetadata } from "@/app/lib/seo";

export async function generateMetadata({ params }) {
  return staticPageMetadata("buscar", "/buscar", await resolveLang(params));
}

export default function BuscarLayout({ children }) {
  return children;
}
