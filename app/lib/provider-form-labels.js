/** Textos humanos compartidos entre wizard y editar-perfil. */

export const PROVIDER_INPUT_CLASS =
  "w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30";

export const PROFILE_LABELS = {
  title: "Cuéntanos quién eres",
  subtitle: "Esto solo lo haces una vez. Lo verán todas las familias.",
  foto: "Añade una foto tuya",
  cambiarFoto: "Cambiar foto",
  nombre: "¿Cómo te llamas?",
  apellidos: "Apellidos",
  ciudad: "¿En qué ciudad estás?",
  anosExperiencia: "Años de experiencia",
  bio: "¿Por qué deberían elegirte?",
  personalidad: "¿Qué te gusta hacer? Tu personalidad",
  personalidadEdit: "Tu personalidad",
  motivacion: "¿Qué te motivó a ofrecer este servicio?",
  idiomas: "¿Qué idiomas hablas?",
  opcional: "(opcional)",
};

export const VERTICALES_STEP_LABELS = {
  title: "¿Qué quieres ofrecer?",
  subtitle: "Elige una o varias. Crearás un anuncio por cada una.",
  notaDni: "El DNI y los antecedentes se piden una sola vez, aunque ofrezcas varias.",
};

export const SERVICE_LABELS = {
  titulo: "¿Cómo se llama tu servicio?",
  descripcion: "Cuéntanos qué ofreces",
  precio: {
    alojamiento: "¿Cuánto cobras por noche? (€)",
    ninos: "¿Cuánto cobras por hora? (€)",
    mascotas: "¿Cuánto cobras por día? (€)",
  },
  fotos: {
    alojamiento: "Sube fotos de tu espacio",
    alojamientoEdit: "Fotos del alojamiento",
    default: "Sube una foto de tu servicio",
  },
  capacidad: "¿Cuántas personas caben?",
  capacidadPersonas: "Personas",
  capacidadHabitaciones: "Habitaciones",
  capacidadCamas: "Camas",
  capacidadBanos: "Baños",
  tipoAlojamiento: "Tipo de alojamiento",
  // Deprecated alias — usar getModalidadServicioFormCopy(vertical)
  modalidad: "¿Dónde cuidas a los niños?",
  modalidadServicio: {
    ninos: {
      title: "¿Dónde cuidas a los niños?",
      help: "Elige dónde ofreces el servicio.",
    },
    mascotas: {
      title: "¿Qué tipo de cuidado ofreces?",
      help: "Elige cómo cuidas a la mascota.",
    },
  },
  descripcionPlaceholder: {
    alojamiento: "Ej.: piso luminoso cerca del centro, ideal para familias con niños…",
    ninos: "Ej.: niñera con experiencia en bebés, actividades al aire libre…",
    mascotas: "Ej.: cuidado en mi hogar con jardín, paseos diarios y fotos de tu mascota…",
  },
  operativo: {
    title: "Disponibilidad y reservas",
    subtitle: "Ya lo dejamos listo con lo más común. Cámbialo si quieres.",
  },
};

export const DIRECCION_LABELS = {
  direccion: "Dirección exacta",
  direccionPlaceholder: "Calle, número, piso, ciudad, código postal",
  direccionHint:
    "Esta dirección solo se compartirá con el cliente tras confirmar la reserva",
  telefono: "Teléfono de contacto para este servicio",
  telefonoPlaceholder: "+34 600 000 000",
};

export const DOCUMENT_LABELS = {
  title: "Tus documentos",
  subtitle: "Solo te pedimos lo necesario. Si ya lo subiste, no hace falta otra vez.",
  yaLoTenemos: "✓ Ya lo tenemos",
  listo: "Listo",
  faltaSubir: "Falta subir",
  opcional: "Opcional",
  subiendo: "Subiendo…",
  subir: "Subir",
  cambiar: "Cambiar",
  pendientePublicar: "Pendiente para publicar",
};

export const NAV_LABELS = {
  atras: "← Atrás",
  continuar: "Continuar",
  guardando: "Guardando tu progreso…",
};

export const RESUMEN_LABELS = {
  title: "Última revisión",
  subtitle: "Comprueba que todo esté bien antes de enviar.",
  enviar: "Enviar mi perfil para revisión",
  enviando: "Enviando…",
};

export const CONFIRMACION_LABELS = {
  title: "¡Buen comienzo! Tu alta está enviada",
  subtitle:
    "Para publicar tu anuncio y recibir reservas, aún te faltan algunos pasos:",
};

export const WIZARD_STEP_LABELS = {
  perfil: "Quién eres",
  verticales: "Qué ofreces",
  documentos: "Tus documentos",
  preview: "Vista previa",
  resumen: "Última revisión",
};

export function servicePrecioLabel(vertical) {
  return SERVICE_LABELS.precio[vertical] || SERVICE_LABELS.precio.alojamiento;
}

export function serviceFotosLabel(vertical, mode = "wizard") {
  if (vertical === "alojamiento") {
    return mode === "edit"
      ? SERVICE_LABELS.fotos.alojamientoEdit
      : SERVICE_LABELS.fotos.alojamiento;
  }
  return SERVICE_LABELS.fotos.default;
}

export function serviceDescripcionPlaceholder(vertical) {
  return SERVICE_LABELS.descripcionPlaceholder[vertical] || "";
}
