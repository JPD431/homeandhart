/**
 * Aviso en /anuncio/[serviceId] cuando el dueño ve su anuncio no publicado.
 */
export default function AnuncioPreviewBanner() {
  return (
    <div
      className="border-b px-5 py-3 text-center text-[12px] leading-relaxed"
      style={{
        backgroundColor: "#fdf3e3",
        borderColor: "#e8dcc8",
        color: "#5c4a32",
      }}
      role="status"
    >
      <strong className="font-semibold">Vista previa</strong>
      {" — así verán las familias tu anuncio. "}
      <span className="text-[#92400e]">Aún no está publicado.</span>
    </div>
  );
}
