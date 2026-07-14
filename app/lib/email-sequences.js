export const sequences = {
  cliente_bienvenida: {
    asunto: "¡Bienvenida a Home&Heart! 🏠❤️",
    delay: 0,
  },
  cliente_activacion: {
    asunto: "¿Buscas niñera, alojamiento o cuidador de mascotas?",
    delay: 24 * 60 * 60 * 1000,
  },
  cliente_primera_reserva: {
    asunto: "Tu primera reserva con garantía incluida",
    delay: 3 * 24 * 60 * 60 * 1000,
  },
  cliente_reactivacion: {
    asunto: "Te echamos de menos 👋",
    delay: 30 * 24 * 60 * 60 * 1000,
  },
  proveedor_bienvenida: {
    asunto: "Tu perfil está en revisión · Home&Heart",
    delay: 0,
  },
  proveedor_verificado: {
    asunto: "🎉 ¡Tu perfil está activo! Primeras 3 reservas sin comisión",
    delay: 0,
  },
  proveedor_sin_actividad: {
    asunto: "Consejos para conseguir más reservas",
    delay: 7 * 24 * 60 * 60 * 1000,
  },
  proveedor_onboarding_pendiente_1: {
    asunto: "Estás a un paso de ofrecer tus servicios · Home&Heart",
    delay: 24 * 60 * 60 * 1000,
  },
  proveedor_onboarding_pendiente_2: {
    asunto: "¿Retomamos tu alta de proveedor? · Home&Heart",
    delay: 4 * 24 * 60 * 60 * 1000,
  },
};

export const MARKETING_SEQUENCE_TYPES = Object.keys(sequences);
