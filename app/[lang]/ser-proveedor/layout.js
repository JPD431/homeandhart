import { resolveLang, staticPageMetadata } from "@/app/lib/seo";

export async function generateMetadata({ params }) {
  return staticPageMetadata("serProveedor", "/ser-proveedor", await resolveLang(params), { noindex: true });
}

export default function SerProveedorLayout({ children }) {
  return children;
}
