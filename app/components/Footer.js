"use client";

import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { BRAND, SERIF } from "./brand";

function FooterColumn({ title, links }) {
  return (
    <div>
      <p className="text-xs font-bold text-[#111]">{title}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              className="text-xs text-[#888] transition-colors hover:text-[#1d4f91]"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  const { lang } = useLang();
  const t = useTranslation(lang);

  const serviciosLinks = [
    { label: t.footer.alojamiento, href: "#" },
    { label: t.footer.ninos, href: "#" },
    { label: t.footer.mascotas, href: "#" },
  ];

  const empresaLinks = [
    { label: t.footer.nosotros, href: "/nuestra-historia" },
    { label: t.footer.comoFunciona, href: "#" },
    { label: t.footer.garantia, href: "/garantia" },
    { label: t.footer.contacto, href: "/ayuda" },
  ];

  const legalLinks = [
    { label: t.footer.terminos, href: "/legal/terminos" },
    { label: t.footer.privacidad, href: "/legal/privacidad" },
    { label: t.footer.cookies, href: "/legal/cookies" },
  ];

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
            {t.footer.slogan}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-[#888]">
            {t.ecosystem.subtitulo}
          </p>
        </div>

        <FooterColumn title={t.footer.servicios} links={serviciosLinks} />
        <FooterColumn title={t.footer.empresa} links={empresaLinks} />
        <FooterColumn title={t.footer.legal} links={legalLinks} />
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
          © 2025 Home&Heart · {t.footer.derechos}
        </p>
        <p className="text-[11px] text-[#888]">
          {t.footer.jurisdiccion}
        </p>
      </div>
    </footer>
  );
}
