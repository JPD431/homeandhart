export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/dashboard", "/chat", "/api/"],
      },
    ],
    sitemap: "https://homeandheart.es/sitemap.xml",
  };
}
