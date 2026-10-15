import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ lang: "es" }));

vi.mock("@/app/lib/LangContext", () => ({
  useLang: () => ({ lang: state.lang }),
}));
vi.mock("@/app/components/Navbar", () => ({ default: () => null }));

import BlogArticleView from "@/app/blog/[slug]/BlogArticleView";
import BlogIndexView from "@/app/blog/BlogIndexView";
import { formatBlogDate } from "@/app/lib/blog-seed";

const render = (component, props) =>
  renderToStaticMarkup(createElement(component, props));

const post = {
  id: "1",
  slug: "viajar-con-ninos",
  titulo: "Viajar con niños",
  subtitulo: "Consejos prácticos",
  categoria: "familias",
  created_at: "2026-03-05T10:00:00Z",
  readMin: 4,
};

beforeEach(() => {
  state.lang = "es";
});

describe("formatBlogDate", () => {
  it("usa el idioma pedido", () => {
    expect(formatBlogDate("2026-03-05T10:00:00Z")).toContain("marzo");
    expect(formatBlogDate("2026-03-05T10:00:00Z", "en")).toContain("March");
    expect(formatBlogDate(null, "en")).toBe("");
  });
});

describe("BlogIndexView", () => {
  const props = {
    featured: post,
    posts: [{ ...post, id: "2", slug: "otro", titulo: "Otro artículo" }],
    categoria: "todos",
    page: 1,
    totalPages: 3,
  };

  it("español", () => {
    const html = render(BlogIndexView, props);
    expect(html).toContain("Blog Home&amp;Heart");
    expect(html).toContain("Consejos para familias viajeras");
    expect(html).toContain("Destacado");
    expect(html).toContain("Leer más");
    expect(html).toContain("4 min de lectura");
    expect(html).toContain("Página 1 de 3");
    expect(html).toContain("Siguiente");
    expect(html).toContain("Viajar con niños");
    expect(html).not.toContain("Our articles are currently");
  });

  it("inglés: la interfaz se traduce y el contenido se mantiene", () => {
    state.lang = "en";
    const html = render(BlogIndexView, props);
    expect(html).toContain("Home&amp;Heart Blog");
    expect(html).toContain("Tips for travelling families");
    expect(html).toContain("Featured");
    expect(html).toContain("Read more");
    expect(html).toContain("4 min read");
    expect(html).toContain("Page 1 of 3");
    expect(html).toContain("Next →");
    expect(html).toContain("Families");
    expect(html).toContain("March");
    expect(html).toContain("currently available in Spanish only");
    // El título del artículo es contenido de la base de datos: no se toca.
    expect(html).toContain("Viajar con niños");
  });

  it("sin artículos", () => {
    state.lang = "en";
    const html = render(BlogIndexView, { ...props, featured: null, posts: [], totalPages: 1 });
    expect(html).toContain("No articles published yet");
  });
});

describe("BlogArticleView", () => {
  const props = {
    post: { ...post, autor: "Home&Heart" },
    readMin: 4,
    relacionados: [{ slug: "x", titulo: "Relacionado", created_at: "2026-02-01T10:00:00Z" }],
    htmlContent: "<p>Texto</p>",
    heroImage: "https://example.com/a.jpg",
    buscarHref: "/buscar?vertical=ninos&ciudad=Madrid",
  };

  it("español", () => {
    const html = render(BlogArticleView, props);
    expect(html).toContain("Artículos relacionados");
    expect(html).toContain("¿Necesitas un proveedor?");
    expect(html).toContain("¿Buscas familias en Madrid?");
    expect(html).toContain("Buscar ahora");
    expect(html).toContain("4 min de lectura");
  });

  it("inglés", () => {
    state.lang = "en";
    const html = render(BlogArticleView, props);
    expect(html).toContain("Related articles");
    expect(html).toContain("Need a provider?");
    expect(html).toContain("Looking for families in Madrid?");
    expect(html).toContain("Search now");
    expect(html).toContain("4 min read");
    expect(html).toContain("<p>Texto</p>");
  });

  it("sin relacionados", () => {
    state.lang = "en";
    const html = render(BlogArticleView, { ...props, relacionados: [] });
    expect(html).toContain("no more articles in this category");
  });
});
