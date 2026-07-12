/** Emojis por vertical — coherentes en etiquetas, tabs y placeholders. */
export const VERTICAL_EMOJIS = {
  alojamiento: "🏠",
  ninos: "🧒",
  mascotas: "🐕",
};

export function getVerticalEmoji(vertical) {
  return VERTICAL_EMOJIS[vertical] ?? VERTICAL_EMOJIS.alojamiento;
}

export function verticalEmojiLabel(vertical, label) {
  return `${getVerticalEmoji(vertical)} ${label}`;
}
