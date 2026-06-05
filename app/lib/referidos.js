// -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reservas_sin_comision integer DEFAULT 3;
// -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS codigo_referido text UNIQUE;
// -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referido_por text;
// -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referidos_count integer DEFAULT 0;

export function normalizeNombreForCodigo(value) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
    .slice(0, 6)
    .padEnd(6, "X");
}

export function generateCodigoReferido(nombre) {
  const prefix = normalizeNombreForCodigo(nombre);
  const random = Math.floor(100 + Math.random() * 900);
  return `HH-${prefix}${random}`;
}

export function buildReferralLink(codigo) {
  return `https://homeandheart.es/registro?ref=${encodeURIComponent(codigo)}`;
}
