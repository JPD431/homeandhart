import { supabase } from "@/app/lib/supabase";

export default async function sitemap() {
  const baseUrl = "https://homeandheart.es";

  const staticPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/buscar`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/ser-proveedor`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/garantia`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/registro`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/legal/terminos`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/legal/privacidad`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  const ciudades = ["madrid", "barcelona", "valencia", "sevilla", "bilbao"];
  const verticales = ["nineras", "alojamiento", "mascotas"];
  const landingPages = ciudades.flatMap((ciudad) =>
    verticales.map((vertical) => ({
      url: `${baseUrl}/${ciudad}/${vertical}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85,
    })),
  );

  const { data: proveedores } = await supabase
    .from("profiles")
    .select("id, updated_at")
    .eq("role", "proveedor")
    .eq("verificado", true);

  const proveedorPages = (proveedores || []).map((p) => ({
    url: `${baseUrl}/proveedor/${p.id}`,
    lastModified: new Date(p.updated_at),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticPages, ...landingPages, ...proveedorPages];
}
