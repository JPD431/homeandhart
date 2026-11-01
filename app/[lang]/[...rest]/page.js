import { notFound } from "next/navigation";

/** Rutas desconocidas: renderiza not-found.js con cabecera/pie y estado HTTP 404. */
export default function CatchAllNotFound() {
  notFound();
}
