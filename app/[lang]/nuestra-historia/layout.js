import JsonLd from "@/app/components/JsonLd";
import { pageSchema, resolveLang, staticPageMetadata } from "@/app/lib/seo";

export async function generateMetadata({ params }) {
  return staticPageMetadata("historia", "/nuestra-historia", await resolveLang(params));
}

export default async function NuestraHistoriaLayout({ children, params }) {
  const lang = await resolveLang(params);
  return (
    <>
      <JsonLd data={pageSchema("historia", "/nuestra-historia", lang, "AboutPage")} />
      {children}
    </>
  );
}
