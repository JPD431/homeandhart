// -- CREATE TABLE referencias (
// --   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
// --   proveedor_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
// --   nombre_referente text NOT NULL,
// --   email_referente text NOT NULL,
// --   relacion text,
// --   conoce_desde text,
// --   recomendaria boolean,
// --   comentario text,
// --   estado text DEFAULT 'pendiente',
// --   token text UNIQUE,
// --   created_at timestamp with time zone DEFAULT now()
// -- );

export const RELACION_OPTIONS = [
  "Familia para la que trabajé",
  "Vecino/amigo",
  "Compañero de trabajo",
  "Otro",
];

export const CONOCE_DESDE_OPTIONS = [
  { value: "menos de 1 año", label: "Menos de 1 año" },
  { value: "1-3 años", label: "1-3 años" },
  { value: "más de 3 años", label: "Más de 3 años" },
];

export function getReferenteInitial(nombre) {
  return nombre?.trim()?.[0]?.toUpperCase() || "?";
}
