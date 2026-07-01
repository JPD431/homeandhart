export const AMENITIES_GROUPS = [
  {
    title: "Esenciales",
    items: [
      { id: "wifi", label: "Wifi", icon: "📶" },
      { id: "calefaccion", label: "Calefacción", icon: "🔥" },
      { id: "ac", label: "Aire acond.", icon: "❄️" },
      { id: "tv", label: "TV", icon: "📺" },
      { id: "agua_caliente", label: "Agua caliente", icon: "🚿" },
      { id: "ascensor", label: "Ascensor", icon: "🛗" },
      { id: "parking", label: "Parking", icon: "🅿️" },
      { id: "accesible", label: "Accesible", icon: "♿" },
    ],
  },
  {
    title: "Baño / dormitorio",
    items: [
      { id: "sabanas", label: "Sábanas", icon: "🛏️" },
      { id: "toallas", label: "Toallas", icon: "🧺" },
      { id: "secador", label: "Secador", icon: "💨" },
      { id: "armario", label: "Armario", icon: "🚪" },
      { id: "escritorio", label: "Escritorio", icon: "🖥️" },
      { id: "cuna", label: "Cuna", icon: "👶" },
      { id: "trona", label: "Trona", icon: "🪑" },
      { id: "chimenea", label: "Chimenea", icon: "🪵" },
    ],
  },
  {
    title: "Cocina / extras",
    items: [
      { id: "cocina", label: "Cocina", icon: "🍳" },
      { id: "nevera", label: "Nevera", icon: "🧊" },
      { id: "microondas", label: "Microondas", icon: "📻" },
      { id: "lavadora", label: "Lavadora", icon: "🫧" },
      { id: "secadora", label: "Secadora", icon: "👕" },
      { id: "cafetera", label: "Cafetera", icon: "☕" },
      { id: "jardin", label: "Jardín", icon: "🌿" },
      { id: "terraza", label: "Terraza", icon: "🌅" },
    ],
  },
];

const AMENITIES_BY_ID = new Map(
  AMENITIES_GROUPS.flatMap((group) =>
    group.items.map((item) => [item.id, item]),
  ),
);

/** Resuelve ids de amenities a { id, label, icon }. Ignora ids desconocidos. */
export function resolveAmenities(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  return ids
    .map((id) => AMENITIES_BY_ID.get(id))
    .filter(Boolean);
}
