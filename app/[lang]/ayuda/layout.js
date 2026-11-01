import { resolveLang, staticPageMetadata } from "@/app/lib/seo";

export async function generateMetadata({ params }) {
  return staticPageMetadata("ayuda", "/ayuda", await resolveLang(params), { noindex: true });
}

export default function AyudaLayout({ children }) {
  return children;
}
