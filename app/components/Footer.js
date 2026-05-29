import { BRAND, SERIF } from "./brand";

const DARK_BLUE = "#163a6b";

const PLATFORM_LINKS = [
  "Cómo funciona",
  "Alojamiento",
  "Cuidado de niños",
  "Cuidado de mascotas",
  "Paquetes",
];

const ABOUT_LINKS = [
  "Quiénes somos",
  "Nuestros valores",
  "Para proveedores",
  "Prensa",
  "Contacto",
];

const LEGAL_LINKS = [
  "Términos de uso",
  "Privacidad",
  "Cookies",
  "RGPD",
  "Aviso legal",
];

const LANGUAGES = [
  { code: "ES", active: true },
  { code: "EN", active: false },
  { code: "FR", active: false },
  { code: "DE", active: false },
];

function FooterColumn({ title, links }) {
  return (
    <div>
      <p className="text-xs font-bold text-[#111]">{title}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {links.map((link) => (
          <li key={link}>
            <a
              href="#"
              className="text-xs text-[#888] transition-colors hover:text-[#1d4f91]"
            >
              {link}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  return (
    <footer
      className="bg-white"
      style={{
        borderTop: `0.5px solid ${BRAND.border}`,
        padding: "44px 40px 28px",
      }}
    >
      <div
        className="mx-auto grid gap-8 sm:grid-cols-2 lg:grid-cols-4"
        style={{ maxWidth: "960px", gap: "32px" }}
      >
        <div>
          <p className="text-[18px] text-[#111]" style={{ fontFamily: SERIF }}>
            Home<span className="italic text-[#1d4f91]">&</span>Heart
          </p>
          <p
            className="mt-2 text-[11px] italic text-[#888]"
            style={{ fontFamily: SERIF }}
          >
            Donde estés, estamos.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-[#888]">
            El ecosistema completo para tu familia — tanto si viajas como si lo
            necesitas en tu ciudad.
          </p>
        </div>

        <FooterColumn title="Plataforma" links={PLATFORM_LINKS} />
        <FooterColumn title="Nosotros" links={ABOUT_LINKS} />
        <FooterColumn title="Legal" links={LEGAL_LINKS} />
      </div>

      <div
        className="mx-auto mt-8 flex flex-wrap items-center justify-between gap-2"
        style={{
          maxWidth: "960px",
          borderTop: `0.5px solid ${BRAND.border}`,
          paddingTop: "18px",
        }}
      >
        <p className="text-[11px] text-[#888]">
          © 2025 Home&Heart · Todos los derechos reservados
        </p>
        <p className="text-[11px] text-[#888]">
          Madrid · Estonia (jurisdicción legal)
        </p>
        <div className="flex gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              className="rounded-md px-2.5 py-1 text-[11px] transition-opacity hover:opacity-80"
              style={
                lang.active
                  ? {
                      backgroundColor: BRAND.light,
                      color: DARK_BLUE,
                      fontWeight: 500,
                    }
                  : { color: "#888" }
              }
              aria-current={lang.active ? "true" : undefined}
            >
              {lang.code}
            </button>
          ))}
        </div>
      </div>
    </footer>
  );
}
