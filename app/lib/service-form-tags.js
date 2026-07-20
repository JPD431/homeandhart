export const TIPO_ALOJAMIENTO_OPTIONS = [
  { value: "completo", label: "Entero", desc: "Piso o casa completa" },
  { value: "habitacion_privada", label: "Hab. privada", desc: "Habitación propia" },
  { value: "habitacion_compartida", label: "Compartida", desc: "Compartes habitación" },
  { value: "habitacion_hotel", label: "Hotel", desc: "Habitación de hotel" },
  { value: "otros", label: "Otro", desc: "Otro tipo de alojamiento" },
];

export const TIPO_ALOJAMIENTO_EDIT_OPTIONS = [
  { value: "completo", label: "Alojamiento completo — piso o casa entera" },
  { value: "habitacion_privada", label: "Habitación privada" },
  { value: "habitacion_compartida", label: "Habitación compartida" },
  { value: "habitacion_hotel", label: "Habitación de hotel" },
  { value: "otros", label: "Otros" },
];

export const MODALIDAD_NINOS_OPTIONS = [
  { value: "domicilio_proveedor", label: "En mi casa" },
  { value: "domicilio_cliente", label: "En casa de la familia" },
  { value: "ambas", label: "Las dos (el cliente elige)" },
];

export const MODALIDAD_MASCOTAS_OPTIONS = [
  { value: "todo_incluido", label: "Se queda en mi casa (guardería)" },
  { value: "paseos", label: "Paseo (recojo a la mascota)" },
  { value: "domicilio_cliente", label: "En casa del dueño" },
  { value: "domicilio_proveedor", label: "En mi casa" },
];

/** Copy del bloque services.modalidad en formulario proveedor. */
export function getModalidadServicioFormCopy(vertical) {
  if (vertical === "mascotas") {
    return {
      title: "¿Qué tipo de cuidado ofreces?",
      help: "Elige cómo cuidas a la mascota.",
      options: MODALIDAD_MASCOTAS_OPTIONS,
    };
  }
  return {
    title: "¿Dónde cuidas a los niños?",
    help: "Elige dónde ofreces el servicio.",
    options: MODALIDAD_NINOS_OPTIONS,
  };
}

export const EDADES_TAGS = ["0-1", "1-3", "3-6", "6-12", "12+"];
export const FORMACION_TAGS = [
  "Educación infantil",
  "Primeros auxilios",
  "Enfermería",
  "Magisterio",
  "Monitor ocio",
];
export const ACTIVIDADES_TAGS = [
  "Lectura",
  "Manualidades",
  "Música",
  "Naturaleza",
  "Cocina",
  "Deporte",
  "Juegos",
  "Tecnología",
  "Idiomas",
  "Teatro",
  "Mindfulness",
];
export const ANIMALES_TAGS = [
  "Perros",
  "Gatos",
  "Conejos",
  "Aves",
  "Roedores",
  "Peces",
  "Reptiles",
];
export const TAMANO_PERRO_TAGS = ["Pequeño", "Mediano", "Grande", "Cualquier tamaño"];
export const CERT_MASCOTAS_TAGS = [
  "Adiestrador",
  "Auxiliar vet.",
  "Primeros auxilios animal",
  "Etología",
];
