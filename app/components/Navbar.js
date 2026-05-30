import Link from "next/link";
import { BRAND } from "./brand";

function Logo() {
  return (
    <div className="flex flex-col">
      <span className="text-xl font-semibold tracking-tight text-[#1a1a1a] sm:text-2xl">
        Home<span className="italic text-[#1d4f91]">&</span>Heart
      </span>
      <span className="mt-0.5 text-xs text-[#5c5c5c] sm:text-sm">
        Donde estés, estamos.
      </span>
    </div>
  );
}

export default function Navbar() {
  return (
    <header
      className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-md"
      style={{ borderColor: BRAND.border }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0 no-underline">
          <Logo />
        </Link>
        <nav
          className="hidden items-center gap-8 text-sm font-medium text-[#444] md:flex"
          aria-label="Principal"
        >
          <a
            href="#"
            className="transition-colors hover:text-[#1d4f91]"
            style={{ color: BRAND.primary }}
          >
            Inicio
          </a>
          <a href="#" className="transition-colors hover:text-[#1d4f91]">
            Servicios
          </a>
          <a href="#" className="transition-colors hover:text-[#1d4f91]">
            Cómo funciona
          </a>
          <a href="#" className="transition-colors hover:text-[#1d4f91]">
            Ser proveedor
          </a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="hidden rounded-lg px-4 py-2 text-sm font-medium text-[#444] no-underline transition-colors hover:bg-[#f7f5f2] sm:inline-block"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/registro"
            className="rounded-lg px-4 py-2 text-sm font-medium text-white no-underline transition-opacity hover:opacity-90"
            style={{ backgroundColor: BRAND.primary }}
          >
            Registrarse
          </Link>
        </div>
      </div>
    </header>
  );
}
