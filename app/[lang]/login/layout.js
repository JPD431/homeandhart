import { resolveLang, staticPageMetadata } from "@/app/lib/seo";

export async function generateMetadata({ params }) {
  return staticPageMetadata("login", "/login", await resolveLang(params), { noindex: true });
}

export default function LoginLayout({ children }) {
  return children;
}
