import { Suspense } from "react";
import { BRAND } from "@/app/components/brand";

function ChatFallback() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center font-sans text-sm text-[#666]"
      style={{ backgroundColor: BRAND.warm }}
    >
      Cargando chat…
    </div>
  );
}

export default function ChatLayout({ children }) {
  return <Suspense fallback={<ChatFallback />}>{children}</Suspense>;
}
