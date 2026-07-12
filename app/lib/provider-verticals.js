import { VERTICAL_EMOJIS, verticalEmojiLabel } from "@/app/lib/vertical-emojis";

/** Colores, títulos y metadatos por vertical (wizard + editar-perfil). */

export const VERTICAL_COLORS = {
  alojamiento: "#1d4f91",
  ninos: "#0e7a5c",
  mascotas: "#c47d1a",
};

export const PRIMARY = VERTICAL_COLORS.alojamiento;
export const GREEN = VERTICAL_COLORS.ninos;
export const ORANGE = VERTICAL_COLORS.mascotas;

export const SERVICE_HEADER_TITLES = {
  alojamiento: "Tu alojamiento",
  ninos: "Tu servicio de niñera",
  mascotas: "Tu servicio de mascotas",
};

export function getVerticalColor(vertical) {
  return VERTICAL_COLORS[vertical] || PRIMARY;
}

export function getServiceHeaderTitle(vertical) {
  return SERVICE_HEADER_TITLES[vertical] || "Tu servicio";
}

export const VERTICALES_CARDS = [
  {
    id: "alojamiento",
    nombre: "Alojamiento",
    color: PRIMARY,
    icono: VERTICAL_EMOJIS.alojamiento,
    subtitulo: "Recibe familias en tu espacio",
    precioRef: "desde 45€/noche",
    beneficios: [
      "Tú pones el precio y las normas",
      "Pagos seguros con Stripe",
      "Sin comisión los primeros 3 meses",
    ],
  },
  {
    id: "ninos",
    nombre: "Niñera",
    color: GREEN,
    icono: VERTICAL_EMOJIS.ninos,
    subtitulo: "Cuida niños con confianza",
    precioRef: "desde 12€/hora",
    beneficios: [
      "Horarios flexibles",
      "Referencias verificadas",
      "Familias de tu zona",
    ],
  },
  {
    id: "mascotas",
    nombre: "Mascotas",
    color: ORANGE,
    icono: VERTICAL_EMOJIS.mascotas,
    subtitulo: "Cuida mascotas como en casa",
    precioRef: "desde 18€/día",
    beneficios: [
      "Mascotas de todos los tamaños",
      "Actualizaciones en tiempo real",
      "Seguro de responsabilidad",
    ],
  },
];

/** Lista compacta para editar-perfil (tabs, badges). */
export const VERTICALS = [
  { id: "alojamiento", label: "Alojamiento", color: PRIMARY, emoji: VERTICAL_EMOJIS.alojamiento },
  { id: "ninos", label: "Niñera", color: GREEN, emoji: VERTICAL_EMOJIS.ninos },
  { id: "mascotas", label: "Mascotas", color: ORANGE, emoji: VERTICAL_EMOJIS.mascotas },
];

export const VERTICAL_DOC_LABELS = {
  alojamiento: verticalEmojiLabel("alojamiento", "Alojamiento"),
  ninos: verticalEmojiLabel("ninos", "Niñera"),
  mascotas: verticalEmojiLabel("mascotas", "Mascotas"),
};
