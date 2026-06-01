import { Suspense } from "react";
import { BRAND } from "@/app/components/brand";

function BuscarFallback() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center font-sans text-sm text-[#666]"
      style={{ backgroundColor: BRAND.warm }}
    >
      Cargando búsqueda…
    </div>
  );
}

export default function BuscarLayout({ children }) {
  return <Suspense fallback={<BuscarFallback />}>{children}</Suspense>;
}
