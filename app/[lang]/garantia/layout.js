import JsonLd from "@/app/components/JsonLd";
import { pageSchema, resolveLang, staticPageMetadata } from "@/app/lib/seo";

export async function generateMetadata({ params }) {
  return staticPageMetadata("garantia", "/garantia", await resolveLang(params));
}

export default async function GarantiaLayout({ children, params }) {
  const lang = await resolveLang(params);
  return (
    <>
      <JsonLd data={pageSchema("garantia", "/garantia", lang, "WebPage")} />
      {children}
    </>
  );
}
