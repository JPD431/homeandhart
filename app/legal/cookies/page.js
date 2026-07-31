import Link from "next/link";
import LegalPageLayout from "@/app/components/LegalPageLayout";
import { COOKIE_NOTICE_VERSION } from "@/app/lib/cookie-notice";

const linkClass =
  "font-medium text-[#1d4f91] underline underline-offset-2";

const sections = [
  {
    title: "Aviso importante",
    body: (
      <p>
        Este documento describe de forma honesta las cookies y el almacenamiento
        que Home&amp;Heart usa hoy en la plataforma. Es una{" "}
        <strong className="font-medium text-[#444]">versión de trabajo</strong>;
        los textos legales definitivos los revisará un abogado. Versión del
        aviso: {COOKIE_NOTICE_VERSION}.
      </p>
    ),
  },
  {
    title: "Qué usamos (y qué no)",
    body: (
      <div className="flex flex-col gap-3">
        <p>
          Usamos cookies y almacenamiento del navegador para que la web
          funcione (sesión, preferencias) y, solo cuando corresponde, servicios
          de terceros necesarios para una función concreta: pagos (Stripe) y
          mapas (Mapbox).
        </p>
        <p>
          <strong className="font-medium text-[#444]">
            No usamos cookies de publicidad ni herramientas de seguimiento o
            analytics de terceros
          </strong>{" "}
          (por ejemplo, no hay Google Analytics, Meta Pixel, Hotjar ni
          equivalentes en el código actual).
        </p>
      </div>
    ),
  },
  {
    title: "Cookies y almacenamiento esenciales (propios)",
    body: (
      <ul className="list-disc space-y-3 pl-5">
        <li>
          <strong className="font-medium text-[#444]">
            Sesión de Supabase Auth
          </strong>{" "}
          (cookies del tipo{" "}
          <code className="rounded bg-[#f4f2ee] px-1 text-sm">
            sb-…-auth-token
          </code>
          , a veces partidas en varios trozos): mantienen tu inicio de sesión.
          Sin ellas no podrías permanecer logueado. Duración típica larga
          (configuración de autenticación; en el cliente suele llegar hasta
          ~400 días).
        </li>
        <li>
          <strong className="font-medium text-[#444]">hh_modo</strong> (cookie +
          localStorage): recuerda si navegas como familia (cliente) o como
          proveedor. Duración de la cookie: 1 año.
        </li>
        <li>
          <strong className="font-medium text-[#444]">localStorage</strong>:
          idioma (<code className="rounded bg-[#f4f2ee] px-1 text-sm">lang</code>
          ), aviso de cookies (
          <code className="rounded bg-[#f4f2ee] px-1 text-sm">
            cookie_consent
          </code>
          ), dismiss del aviso PWA (
          <code className="rounded bg-[#f4f2ee] px-1 text-sm">
            pwa_dismissed
          </code>
          ).
        </li>
        <li>
          <strong className="font-medium text-[#444]">sessionStorage</strong>:
          carrito de reserva (
          <code className="rounded bg-[#f4f2ee] px-1 text-sm">bundle_state</code>
          ), redirección tras login, y dismiss temporales de banners (onboarding,
          invitaciones de familia). Se borran al cerrar la pestaña.
        </li>
      </ul>
    ),
  },
  {
    title: "Terceros funcionales",
    body: (
      <ul className="list-disc space-y-3 pl-5">
        <li>
          <strong className="font-medium text-[#444]">Stripe</strong> — se carga
          en el flujo de reserva/pago para procesar la tarjeta de forma segura.
          Puede usar cookies o almacenamiento en dominios de Stripe (pago y
          prevención de fraude). Política de Stripe:{" "}
          <a
            href="https://stripe.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            stripe.com/privacy
          </a>
          .
        </li>
        <li>
          <strong className="font-medium text-[#444]">Mapbox</strong> — se usa
          para mostrar el mapa al buscar y para geocodificar ubicaciones
          (autocompletado de ciudad, zona aproximada). Envía peticiones a
          servidores de Mapbox (p. ej. IP, zona del mapa, token público).
          Política de Mapbox:{" "}
          <a
            href="https://www.mapbox.com/legal/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            mapbox.com/legal/privacy
          </a>
          .
        </li>
      </ul>
    ),
  },
  {
    title: "Cómo gestionar el aviso",
    body: (
      <p>
        El banner inferior te informa de este uso. Al pulsar «Aceptar»
        guardamos en tu navegador que has visto el aviso (versión y fecha), para
        no mostrarlo de nuevo. Puedes borrar cookies y datos del sitio desde la
        configuración de tu navegador. Más sobre tus datos personales en la{" "}
        <Link href="/legal/privacidad" className={linkClass}>
          Política de privacidad
        </Link>
        .
      </p>
    ),
  },
];

export const metadata = {
  title: "Política de cookies · Home&Heart",
};

export default function CookiesPage() {
  return (
    <LegalPageLayout
      title="Política de cookies"
      updatedAt={`Versión de trabajo · aviso ${COOKIE_NOTICE_VERSION} · julio 2026`}
      sections={sections}
    />
  );
}
