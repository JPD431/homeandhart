/**
 * Filtro de contacto en chat (anti-desintermediación).
 * Solo debe aplicarse PRE-reserva confirmada entre los participantes.
 */

export const CONTACT_FILTER_NOTICE =
  "Por tu seguridad y para que la Garantía Home&Heart te cubra, mantén la conversación y el pago dentro de la plataforma. Podrás compartir tus datos de contacto una vez confirmada la reserva.";

export const CONTACT_FILTER_BANNER =
  "Antes de confirmar la reserva, el contacto (teléfono, email, WhatsApp…) se oculta automáticamente. Así la Garantía Home&Heart puede protegeros. Tras reservar, podréis coordinaros con normalidad.";

const HIDDEN = "[oculto]";

const EMAIL_RE =
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

const OBFUSCATED_EMAIL_RE =
  /[A-Za-z0-9._%+-]+\s*(?:arroba|@)\s*[A-Za-z0-9.-]+\s*(?:punto|\.)\s*(?:com|es|net|org|gmail|hotmail|outlook|yahoo)\b/gi;

const EXTERNAL_CONTACT_LINK_RE =
  /(?:https?:\/\/)?(?:(?:www\.)?(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|t\.me|telegram\.me|telegram\.org|instagram\.com)(?:\/[^\s]*)?)/gi;

const HANDLE_RE = /(?<![A-Za-z0-9._%+-])@[A-Za-z0-9._]{2,30}\b/g;

const DIGIT_WORD =
  "(?:cero|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)";
const OBFUSCATED_PHONE_WORDS_RE = new RegExp(
  `(?:${DIGIT_WORD}[\\s,./-]*){6,}`,
  "gi",
);

/** Candidatos a teléfono (afinados luego por isLikelyPhone). */
const PHONE_CANDIDATE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{2,4}[\s.-]?\d{2,4}(?:[\s.-]?\d{2,4})?/g;

function countDigits(s) {
  return (String(s).match(/\d/g) || []).length;
}

/**
 * ¿El match parece un teléfono real y no un precio/fecha/código?
 * @param {string} match
 * @param {string} fullText
 * @param {number} index
 */
export function isLikelyPhone(match, fullText, index) {
  const trimmed = String(match).trim();
  if (!trimmed) return false;

  const digits = countDigits(trimmed);
  if (digits < 8 || digits > 15) return false;

  // Fechas ISO / EU
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(trimmed)) return false;
  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(trimmed)) return false;

  // Precio con decimales (45.50, 100,00) y pocos dígitos totales
  if (/^\d{1,5}[.,]\d{1,2}$/.test(trimmed) && digits <= 7) return false;

  const before = fullText.slice(Math.max(0, index - 4), index);
  const after = fullText.slice(
    index + match.length,
    index + match.length + 4,
  );
  const ctx = `${before}${after}`;
  if (/€|eur/i.test(ctx)) return false;
  // "100€" o "€50" pegados
  if (/€/.test(before.slice(-1) + after.slice(0, 1))) return false;

  // Horas / duraciones tipo 10:30
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) return false;

  return true;
}

function replacePhones(text) {
  return text.replace(PHONE_CANDIDATE_RE, (match, offset) => {
    if (isLikelyPhone(match, text, offset)) {
      return HIDDEN;
    }
    return match;
  });
}

/**
 * Filtra contacto en texto libre.
 * @param {string} text
 * @param {{ applyFilter?: boolean }} [opts]
 * @returns {{ content: string, censored: boolean }}
 */
export function filterChatContent(text, opts = {}) {
  const applyFilter = opts.applyFilter !== false;
  const raw = typeof text === "string" ? text : "";
  if (!applyFilter) {
    return { content: raw.trim(), censored: false };
  }
  if (!raw.trim()) {
    return { content: "", censored: false };
  }

  let result = raw;
  const before = result;

  result = result.replace(EMAIL_RE, HIDDEN);
  result = result.replace(OBFUSCATED_EMAIL_RE, HIDDEN);
  result = result.replace(EXTERNAL_CONTACT_LINK_RE, HIDDEN);
  result = result.replace(HANDLE_RE, HIDDEN);
  result = result.replace(OBFUSCATED_PHONE_WORDS_RE, HIDDEN);
  result = replacePhones(result);

  // Frases de ofuscación sueltas muy obvias
  result = result.replace(
    /\b(?:mi\s+)?(?:correo|email|mail)\s+(?:es|:)\s*[^\s]+/gi,
    HIDDEN,
  );
  result = result.replace(
    /\b(?:arroba|punto\s+com)\b/gi,
    HIDDEN,
  );

  const censored = result !== before;
  return { content: result.trim(), censored };
}

/**
 * Filtra el campo mensaje de un payload especial (oferta / solicitud).
 * @param {string} mensaje
 * @param {{ applyFilter?: boolean }} [opts]
 */
export function filterSpecialMensaje(mensaje, opts = {}) {
  return filterChatContent(
    typeof mensaje === "string" ? mensaje : "",
    opts,
  );
}
