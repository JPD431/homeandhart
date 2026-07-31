import Navbar from "@/app/components/Navbar";
import { BRAND, SERIF } from "@/app/components/brand";

export default function LegalPageLayout({
  title,
  updatedAt = "Última actualización: junio 2025",
  sections,
}) {
  return (
    <main className="min-h-screen bg-white text-[#1a1a1a]">
      <Navbar />
      <article
        className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
        style={{ maxWidth: "720px" }}
      >
        <header className="border-b pb-8" style={{ borderColor: BRAND.border }}>
          <h1
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ fontFamily: SERIF, color: BRAND.primary }}
          >
            {title}
          </h1>
          <p className="mt-3 text-sm text-[#888]">{updatedAt}</p>
        </header>

        <div className="mt-10 flex flex-col gap-10">
          {sections.map((section) => (
            <section key={section.title}>
              <h2
                className="text-xl font-semibold text-[#1a1a1a] sm:text-[1.35rem]"
                style={{ fontFamily: SERIF }}
              >
                {section.title}
              </h2>
              {typeof section.body === "string" ? (
                <p className="mt-3 text-base leading-relaxed text-[#5c5c5c]">
                  {section.body}
                </p>
              ) : (
                <div className="mt-3 text-base leading-relaxed text-[#5c5c5c]">
                  {section.body}
                </div>
              )}
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
