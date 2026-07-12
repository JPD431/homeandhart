/** Iconos SVG por vertical — mismo estilo outline (Heroicons) en toda la app. */

export function LodgingIcon({ className, style, ...props }) {
  return (
    <svg
      className={className}
      style={style}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
      />
    </svg>
  );
}

/** Grupo / familias — sección ecosistema. */
export function ChildcareIcon({ className, style, ...props }) {
  return (
    <svg
      className={className}
      style={style}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
      />
    </svg>
  );
}

/** Persona — reservas, checkout, completar perfil. */
export function PersonIcon({ className, style, ...props }) {
  return (
    <svg
      className={className}
      style={style}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
      />
    </svg>
  );
}

/** Huella de mascota — 4 dedos + almohadilla (legible a tamaño pequeño). */
export function PetIcon({ className, style, ...props }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <circle cx="7.5" cy="5.5" r="1.75" />
      <circle cx="12" cy="4" r="1.75" />
      <circle cx="16.5" cy="5.5" r="1.75" />
      <circle cx="5" cy="10" r="1.5" />
      <circle cx="19" cy="10" r="1.5" />
      <path d="M12 21.5c-4 0-7.5-2.2-7.5-6.5 0-2.2 1.6-4 3.4-5 1.2-.8 2.6-1.2 4.1-1.2s2.9.4 4.1 1.2c1.8 1 3.4 2.8 3.4 5 0 4.3-3.5 6.5-7.5 6.5z" />
    </svg>
  );
}

const VERTICAL_ICON_MAP = {
  alojamiento: LodgingIcon,
  ninos: PersonIcon,
  mascotas: PetIcon,
};

/** Icono SVG según vertical (alojamiento, ninos, mascotas). */
export function VerticalIcon({ vertical, className, style, color }) {
  const Icon = VERTICAL_ICON_MAP[vertical] || LodgingIcon;
  return (
    <Icon
      className={className}
      style={color ? { ...style, color } : style}
    />
  );
}
