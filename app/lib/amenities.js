export const AMENITIES_GROUPS = [
  {
    title: "Conectividad y confort",
    items: [
      { id: "wifi", label: "Wifi", icon: "📶" },
      { id: "calefaccion", label: "Calefacción", icon: "🔥" },
      { id: "ac", label: "Aire acondicionado", icon: "❄️" },
      { id: "tv", label: "TV", icon: "📺" },
      { id: "agua_caliente", label: "Agua caliente", icon: "🚿" },
      { id: "ascensor", label: "Ascensor", icon: "🛗" },
      { id: "accesible", label: "Accesible", icon: "♿" },
      { id: "ventilador", label: "Ventilador", icon: "🌀" },
    ],
  },
  {
    title: "Dormitorio y descanso",
    items: [
      { id: "sabanas", label: "Sábanas", icon: "🛏️" },
      { id: "armario", label: "Armario", icon: "🚪" },
      { id: "escritorio", label: "Escritorio", icon: "🖥️" },
      { id: "chimenea", label: "Chimenea", icon: "🪵" },
      { id: "blackout", label: "Cortinas opacas", icon: "🌙" },
      { id: "entrada_privada", label: "Entrada privada", icon: "🔑" },
    ],
  },
  {
    title: "Baño y lavandería",
    items: [
      { id: "toallas", label: "Toallas", icon: "🧺" },
      { id: "secador", label: "Secador de pelo", icon: "💨" },
      { id: "gel_shampoo", label: "Gel y champú", icon: "🧴" },
      { id: "banera", label: "Bañera", icon: "🛁" },
      { id: "lavadora", label: "Lavadora", icon: "🫧" },
      { id: "secadora", label: "Secadora", icon: "👕" },
      { id: "plancha", label: "Plancha", icon: "👔" },
    ],
  },
  {
    title: "Cocina y comedor",
    items: [
      { id: "cocina", label: "Cocina equipada", icon: "🍳" },
      { id: "nevera", label: "Nevera", icon: "🧊" },
      { id: "microondas", label: "Microondas", icon: "📻" },
      { id: "cafetera", label: "Cafetera", icon: "☕" },
      { id: "horno", label: "Horno", icon: "🔥" },
      { id: "vitroceramica", label: "Vitrocerámica", icon: "🍲" },
      { id: "tostadora", label: "Tostadora", icon: "🍞" },
      { id: "hervidor", label: "Hervidor", icon: "🫖" },
      { id: "vajilla_utensilios", label: "Vajilla y utensilios", icon: "🍽️" },
      { id: "barbacoa", label: "Barbacoa", icon: "🥩" },
    ],
  },
  {
    title: "Familia y mascotas",
    items: [
      { id: "cuna", label: "Cuna", icon: "👶" },
      { id: "trona", label: "Trona", icon: "🪑" },
      { id: "juguetes_ninos", label: "Juguetes para niños", icon: "🧸" },
      { id: "libros_juegos", label: "Libros y juegos", icon: "📚" },
      { id: "monitor_bebe", label: "Monitor de bebé", icon: "📡" },
      { id: "pet_friendly", label: "Admite mascotas", icon: "🐾" },
    ],
  },
  {
    title: "Exterior, parking y vistas",
    items: [
      { id: "parking", label: "Parking", icon: "🅿️" },
      { id: "jardin", label: "Jardín", icon: "🌿" },
      { id: "terraza", label: "Terraza", icon: "🌅" },
      { id: "balcon", label: "Balcón", icon: "🪴" },
      { id: "patio", label: "Patio", icon: "🏡" },
      { id: "piscina", label: "Piscina", icon: "🏊" },
      { id: "vistas_mar", label: "Vistas al mar", icon: "🌊" },
    ],
  },
  {
    title: "Seguridad y servicios",
    items: [
      { id: "detector_humo", label: "Detector de humo", icon: "🚨" },
      { id: "extintor", label: "Extintor", icon: "🧯" },
      { id: "botiquin", label: "Botiquín", icon: "🩹" },
      { id: "caja_fuerte", label: "Caja fuerte", icon: "🔒" },
      { id: "servicio_limpieza", label: "Servicio de limpieza", icon: "🧹" },
      { id: "checkin_autonomo", label: "Check-in autónomo", icon: "🔑" },
    ],
  },
];

const AMENITIES_BY_ID = new Map(
  AMENITIES_GROUPS.flatMap((group) =>
    group.items.map((item) => [item.id, { ...item, group: group.title }]),
  ),
);

const AMENITY_LABELS_EN = {
  wifi: "Wifi", calefaccion: "Heating", ac: "Air conditioning", tv: "TV",
  agua_caliente: "Hot water", ascensor: "Elevator", accesible: "Accessible",
  ventilador: "Fan", sabanas: "Bed linen", armario: "Wardrobe", escritorio: "Desk",
  chimenea: "Fireplace", blackout: "Blackout curtains", entrada_privada: "Private entrance",
  toallas: "Towels", secador: "Hair dryer", gel_shampoo: "Shower gel & shampoo",
  banera: "Bathtub", lavadora: "Washing machine", secadora: "Dryer", plancha: "Iron",
  cocina: "Equipped kitchen", nevera: "Fridge", microondas: "Microwave",
  cafetera: "Coffee maker", horno: "Oven", vitroceramica: "Ceramic hob",
  tostadora: "Toaster", hervidor: "Kettle", vajilla_utensilios: "Dishes & utensils",
  barbacoa: "Barbecue", cuna: "Crib", trona: "High chair", juguetes_ninos: "Kids’ toys",
  libros_juegos: "Books & games", monitor_bebe: "Baby monitor", pet_friendly: "Pets allowed",
  parking: "Parking", jardin: "Garden", terraza: "Terrace", balcon: "Balcony",
  patio: "Patio", piscina: "Pool", vistas_mar: "Sea view", detector_humo: "Smoke detector",
  extintor: "Fire extinguisher", botiquin: "First-aid kit", caja_fuerte: "Safe",
  servicio_limpieza: "Cleaning service", checkin_autonomo: "Self check-in",
};

const AMENITY_GROUP_TITLES_EN = {
  "Conectividad y confort": "Connectivity & comfort",
  "Dormitorio y descanso": "Bedroom & rest",
  "Baño y lavandería": "Bathroom & laundry",
  "Cocina y comedor": "Kitchen & dining",
  "Familia y mascotas": "Family & pets",
  "Exterior, parking y vistas": "Outdoors, parking & views",
  "Seguridad y servicios": "Safety & services",
};

function amenityLabel(item, lang) {
  return lang === "en" ? (AMENITY_LABELS_EN[item.id] ?? item.label) : item.label;
}

function amenityGroupTitle(title, lang) {
  return lang === "en" ? (AMENITY_GROUP_TITLES_EN[title] ?? title) : title;
}

/** Resuelve ids de amenities a { id, label, icon }. Ignora ids desconocidos. */
export function resolveAmenities(ids, lang = "es") {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  return ids
    .map((id) => {
      const item = AMENITIES_BY_ID.get(id);
      if (!item) return null;
      return { id: item.id, label: amenityLabel(item, lang), icon: item.icon };
    })
    .filter(Boolean);
}

/**
 * Amenities seleccionados agrupados por categoría (solo grupos con al menos uno).
 * @returns {{ title: string, items: { id: string, label: string, icon: string }[] }[]}
 */
export function resolveAmenitiesGrouped(ids, lang = "es") {
  if (!Array.isArray(ids) || ids.length === 0) return [];

  const selected = new Set(ids);

  return AMENITIES_GROUPS.map((group) => ({
    title: amenityGroupTitle(group.title, lang),
    items: group.items
      .filter((item) => selected.has(item.id))
      .map((item) => ({ ...item, label: amenityLabel(item, lang) })),
  })).filter((group) => group.items.length > 0);
}
