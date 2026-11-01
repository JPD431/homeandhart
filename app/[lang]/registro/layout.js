import { resolveLang, staticPageMetadata } from "@/app/lib/seo";

export async function generateMetadata({ params }) {
  return staticPageMetadata("registro", "/registro", await resolveLang(params), { noindex: true });
}

export default function RegistroLayout({ children }) {
  return children;
}
