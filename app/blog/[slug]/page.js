import { notFound } from "next/navigation";
import { marked } from "marked";
import BlogArticleView from "@/app/blog/[slug]/BlogArticleView";
import {
  applyInternalLinks,
  CATEGORIA_BUSCAR,
  estimateReadingTime,
} from "@/app/lib/blog-seed";
import { getPublicSupabase } from "@/app/lib/supabase-public";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

marked.setOptions({ gfm: true, breaks: true });

function getImageUrl(categoria, slug, width = 800, height = 400) {
  const safeSlug = slug || "home-heart";
  const seed = safeSlug.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const imageId = (seed % 1000) + 1;
  void categoria;
  void imageId;
  return `https://picsum.photos/seed/${safeSlug}/${width}/${height}`;
}

function getPostImageUrl(post, width = 900, height = 400) {
  return post.imagen_url || getImageUrl(post.categoria, post.slug, width, height);
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const supabase = getPublicSupabase();
  const { data: post } = await supabase
    .from("blog_posts")
    .select("slug, titulo, subtitulo, imagen_url, categoria")
    .eq("slug", slug)
    .eq("publicado", true)
    .maybeSingle();

  if (!post) return { title: "Artículo no encontrado · Home&Heart" };

  const description = post.subtitulo || post.titulo;
  const ogImage = getPostImageUrl(post, 900, 400);

  return {
    title: `${post.titulo} · Home&Heart`,
    description,
    openGraph: {
      title: post.titulo,
      description,
      images: [{ url: ogImage }],
    },
  };
}

function renderMarkdown(content) {
  const linked = applyInternalLinks(content || "");
  return marked.parse(linked);
}

export default async function BlogArticlePage({ params }) {
  const { slug } = await params;
  const supabase = getPublicSupabase();

  const { data: post } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("publicado", true)
    .maybeSingle();

  if (!post) notFound();

  const { data: relacionados } = await supabase
    .from("blog_posts")
    .select("slug, titulo, categoria, created_at")
    .eq("publicado", true)
    .eq("categoria", post.categoria)
    .neq("id", post.id)
    .order("created_at", { ascending: false })
    .limit(3);

  const heroImage = getPostImageUrl(post, 900, 400);
  const readMin = estimateReadingTime(post.contenido);
  const { contenido: _contenido, ...postMeta } = post;
  void _contenido;
  const htmlContent = renderMarkdown(post.contenido);
  const buscarHref = CATEGORIA_BUSCAR[post.categoria] || "/buscar";

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.titulo,
    description: post.subtitulo,
    author: { "@type": "Organization", name: post.autor || "Home&Heart" },
    datePublished: post.created_at,
    dateModified: post.updated_at || post.created_at,
    image: heroImage,
    publisher: {
      "@type": "Organization",
      name: "Home&Heart",
      logo: { "@type": "ImageObject", url: "https://homeandheart.es/logoo1.png" },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <BlogArticleView
        post={postMeta}
        readMin={readMin}
        relacionados={relacionados ?? []}
        htmlContent={htmlContent}
        heroImage={heroImage}
        buscarHref={buscarHref}
      />
    </>
  );
}
