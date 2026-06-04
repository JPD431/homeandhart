export const translations = {
  es: {
    navbar: {
      inicio: "Inicio",
      servicios: "Servicios",
      comoFunciona: "Cómo funciona",
      serProveedor: "Ser proveedor",
      iniciarSesion: "Iniciar sesión",
      registrarse: "Registrarse",
    },
    hero: {
      titulo: "Por fin, todo lo que necesitas en un solo lugar",
      subtitulo:
        "Alojamiento, cuidado de niños y mascotas — encuentra proveedores verificados cerca de ti",
      donde: "¿Dónde?",
      placeholder: "Busca una ciudad o barrio",
      llegada: "Llegada",
      salida: "Salida",
      queNecesitas: "¿Qué necesitas?",
      buscar: "Buscar",
      todo: "Todo",
      alojamiento: "Alojamiento",
      ninos: "Niños",
      mascotas: "Mascotas",
    },
    buscar: {
      titulo: "Encuentra tu proveedor de confianza",
      resultados: "resultados encontrados",
      sinResultados: "No encontramos proveedores en esta zona todavía.",
      verPerfil: "Ver perfil",
      reservar: "Reservar",
      preguntar: "Preguntar",
    },
  },
  en: {
    navbar: {
      inicio: "Home",
      servicios: "Services",
      comoFunciona: "How it works",
      serProveedor: "Become a host",
      iniciarSesion: "Log in",
      registrarse: "Sign up",
    },
    hero: {
      titulo: "Everything your family needs, in one place",
      subtitulo:
        "Accommodation, childcare and pet sitting — find verified providers near you",
      donde: "Where?",
      placeholder: "Search a city or neighbourhood",
      llegada: "Check in",
      salida: "Check out",
      queNecesitas: "What do you need?",
      buscar: "Search",
      todo: "All",
      alojamiento: "Accommodation",
      ninos: "Childcare",
      mascotas: "Pet sitting",
    },
    buscar: {
      titulo: "Find your trusted provider",
      resultados: "results found",
      sinResultados: "No providers found in this area yet.",
      verPerfil: "View profile",
      reservar: "Book",
      preguntar: "Ask",
    },
  },
};

export function useTranslation(lang = "es") {
  return translations[lang] || translations.es;
}
