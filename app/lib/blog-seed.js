// -- CREATE TABLE blog_posts (
// --   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
// --   slug text UNIQUE NOT NULL,
// --   titulo text NOT NULL,
// --   subtitulo text,
// --   contenido text NOT NULL,
// --   imagen_url text,
// --   categoria text CHECK (categoria IN ('familias', 'mascotas', 'alojamiento', 'nineras', 'viajes', 'consejos')),
// --   tags text[],
// --   autor text DEFAULT 'Home&Heart',
// --   publicado boolean DEFAULT false,
// --   featured boolean DEFAULT false,
// --   created_at timestamp with time zone DEFAULT now(),
// --   updated_at timestamp with time zone DEFAULT now()
// -- );
// -- ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
// -- CREATE POLICY "Lectura publica posts publicados" ON blog_posts FOR SELECT USING (publicado = true);
// -- CREATE POLICY "Admin gestiona posts" ON blog_posts FOR ALL USING (true);

export const BLOG_CATEGORIAS = [
  { id: "todos", label: "Todos" },
  { id: "familias", label: "Familias" },
  { id: "mascotas", label: "Mascotas" },
  { id: "alojamiento", label: "Alojamiento" },
  { id: "nineras", label: "Niñeras" },
  { id: "viajes", label: "Viajes" },
  { id: "consejos", label: "Consejos" },
];

export const CATEGORIA_COLORS = {
  familias: "#1d4f91",
  mascotas: "#c47d1a",
  alojamiento: "#1d4f91",
  nineras: "#0e7a5c",
  viajes: "#1d4f91",
  consejos: "#888",
};

export const CATEGORIA_GRADIENTS = {
  familias: "linear-gradient(160deg, #c5d9ee, #4a85c0)",
  mascotas: "linear-gradient(160deg, #e8c99a, #b8843a)",
  alojamiento: "linear-gradient(160deg, #c5d9ee, #4a85c0)",
  nineras: "linear-gradient(160deg, #a8d5c2, #3d9b86)",
  viajes: "linear-gradient(160deg, #b8c9e0, #5a7aa8)",
  consejos: "linear-gradient(160deg, #d4d4d4, #9a9a9a)",
};

export const CATEGORIA_LABELS = {
  familias: "Familias",
  mascotas: "Mascotas",
  alojamiento: "Alojamiento",
  nineras: "Niñeras",
  viajes: "Viajes",
  consejos: "Consejos",
};

export const CATEGORIA_BUSCAR = {
  familias: "/buscar?vertical=ninos&ciudad=Madrid",
  mascotas: "/buscar?vertical=mascotas&ciudad=Madrid",
  alojamiento: "/buscar?vertical=alojamiento&ciudad=Madrid",
  nineras: "/buscar?vertical=ninos&ciudad=Madrid",
  viajes: "/buscar?ciudad=Madrid",
  consejos: "/buscar?ciudad=Madrid",
};

const CIUDADES_LINK = ["Madrid", "Barcelona", "Valencia", "Sevilla", "Bilbao"];

export function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function estimateReadingTime(text) {
  const words = (text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function formatBlogDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function applyInternalLinks(content) {
  let result = content;
  for (const city of CIUDADES_LINK) {
    const slug = city.toLowerCase();
    const rules = [
      {
        re: new RegExp(`(?<!\\[)niñeras?\\s+(?:en\\s+)?${city}(?!\\])`, "gi"),
        href: `/${slug}/nineras`,
      },
      {
        re: new RegExp(
          `(?<!\\[)cuidadores?\\s+de\\s+mascotas\\s+(?:en\\s+)?${city}(?!\\])`,
          "gi",
        ),
        href: `/${slug}/mascotas`,
      },
      {
        re: new RegExp(
          `(?<!\\[)alojamiento\\s+pet-?friendly\\s+(?:en\\s+)?${city}(?!\\])`,
          "gi",
        ),
        href: `/${slug}/alojamiento`,
      },
      {
        re: new RegExp(`(?<!\\[)niñera\\s+${city}(?!\\])`, "gi"),
        href: `/${slug}/nineras`,
      },
    ];
    for (const { re, href } of rules) {
      result = result.replace(re, (match) => `[${match}](${href})`);
    }
  }
  return result;
}

export const articulosIniciales = [
  {
    slug: "como-elegir-ninera-confianza-madrid",
    titulo: "Cómo elegir una niñera de confianza en Madrid",
    subtitulo:
      "Guía completa para padres: documentos, preguntas clave y señales de alarma",
    categoria: "nineras",
    tags: ["niñera", "Madrid", "seguridad", "consejos"],
    contenido: `Elegir una **niñera en Madrid** no debería ser una lotería. Cuando confías el cuidado de tus hijos a otra persona, necesitas certezas: identidad verificada, antecedentes comprobados, experiencia real y una forma clara de reservar y pagar sin sorpresas. Esta guía recoge lo que los padres más experimentados revisan antes de contratar, con criterios prácticos que puedes aplicar hoy mismo.

## Por qué la verificación importa de verdad

No basta con que alguien sea simpática o viva cerca. Una niñera profesional debe poder demostrar quién es y qué historial tiene. En Home&Heart exigimos **documento de identidad**, **certificado de antecedentes penales** y, para perfiles de cuidado infantil, **certificado de delitos de naturaleza sexual**. Si una candidata evita compartir documentación o te pide pagar solo en efectivo fuera de la plataforma, es una señal de alarma clara.

Pregunta siempre por **formación en primeros auxilios** o **titulación en educación infantil**. No es obligatorio para todas las familias, pero marca la diferencia cuando hay bebés, alergias o niños con necesidades específicas.

## Preguntas clave en la primera conversación

Antes de la primera guardia larga, reserva una videollamada o un encuentro breve con los niños presentes. Estas preguntas te ayudan a decidir con cabeza fría:

- ¿Cuánta experiencia tienes con la edad de mis hijos?
- ¿Cómo actuarías ante una fiebre alta o una reacción alérgica?
- ¿Estás disponible con poca antelación o solo con reserva planificada?
- ¿Puedes acompañarnos en viajes si lo necesitamos?

Muchas familias en la capital buscan flexibilidad: horas sueltas los jueves, fines de semana completos o apoyo durante vacaciones escolares. Deja claro horarios, tarifas y si hay suplemento por noches o desplazamientos.

## Señales de una buena niñera

Una profesional de confianza suele:

- Responder con claridad y sin prisas a tus dudas
- Proponer un pequeño ritual de despedida para que los niños se sientan seguros
- Llevar un cuaderno o enviar un resumen al final del día
- Respetar tus normas sobre pantallas, comida y horarios de sueño

Las **referencias y reseñas** de otras familias son oro. En Home&Heart solo publican perfiles verificados, y las valoraciones tras reservas completadas te dan una foto mucho más fiel que un currículum en papel.

## Madrid: barrios, desplazamientos y logística

La ciudad es grande. Una niñera Chamberí puede ser perfecta para tu zona, pero si vives en Aravaca o Vallecas, confirma tiempos de desplazamiento y si cobra transporte. Algunas profesionales activan **disponible para viajar** y pueden acompañarte en escapadas de fin de semana o vacaciones.

Si es la primera vez que dejas a los niños, empieza con **guardias cortas** de dos o tres horas mientras estás cerca. Aumenta la duración cuando todos estéis cómodos.

## Cómo reservar con tranquilidad

Reservar por una plataforma con **pago protegido** evita malentendidos sobre precio, cancelaciones o cambios de última hora. Pagas una vez, con factura y condiciones visibles. Si surge un imprevio y la niñera cancela con menos de 24 horas, la **Garantía Home&Heart** busca alternativa verificada en unos 30 minutos.

## Conclusión

Encontrar una niñera Madrid de confianza lleva tiempo, pero con checklist claro el proceso es mucho más sencillo. Verifica documentos, haz preguntas directas, lee reseñas y empieza poco a poco. Tus hijos — y tu tranquilidad — lo agradecerán.

¿Lista para dar el siguiente paso? [Explora niñeras verificadas en Madrid](/madrid/nineras) y reserva con pago protegido.`,
    publicado: true,
    featured: true,
  },
  {
    slug: "viajar-con-mascotas-madrid",
    titulo: "Viajar con mascotas a Madrid: guía completa 2026",
    subtitulo:
      "Alojamiento pet-friendly, cuidadores y todo lo que necesitas saber",
    categoria: "mascotas",
    tags: ["mascotas", "Madrid", "viaje", "pet-friendly"],
    contenido: `Madrid recibe cada año a miles de visitantes que no quieren dejar a su perro o gato en casa. La buena noticia es que la capital ha mejorado mucho en **servicios pet-friendly**: hoteles con políticas claras, parques caninos, veterinarios de guardia y **cuidadores de mascotas en Madrid** verificados para cuando necesitas salir unas horas o varios días.

## Antes de viajar: documentación y salud

Revisa el **pasaporte europeo de animales de compañía** o el chip identificativo. Si vienes del extranjero, consulta requisitos sanitarios actualizados. Lleva el cartón de vacunas, antiparasitarios al día y el contacto de tu veterinario habitual por si necesitas una consulta por teléfono.

Para trayectos en tren o avión, cada compañía tiene normas distintas sobre transportín, peso máximo y billetes. Reserva con antelación: en temporada alta los cupos para mascotas se agotan.

## Dónde alojarte con tu mascota

No todos los alojamientos aceptan animales, y los que lo hacen pueden tener límites de tamaño o suplementos. Busca **alojamiento pet-friendly en Madrid** con normas transparentes: ¿aceptan perros grandes?, ¿hay zonas del piso reservadas?, ¿puedes dejar al animal solo unas horas?

En Home&Heart muchos anfitriones indican explícitamente si son pet-friendly y bajo qué condiciones. Filtra en el buscador, lee la descripción con atención y pregunta antes de reservar si tu caso es especial — por ejemplo, dos gatos o un perro de asistencia.

## Cuidadores cuando no puedes llevarla a todas partes

Hay restaurantes, museos y eventos donde tu mascota no puede entrar. Ahí entran los **cuidadores de mascotas Madrid**: paseadores, visitas a domicilio o estancias en casa del cuidador con jardín.

Al elegir perfil, fíjate en:

- Verificación de identidad y antecedentes
- Experiencia con tu especie y tamaño
- Si incluye **paseos**, fotos durante la visita o administración de medicación
- Disponibilidad en festivos o madrugadas

Un buen cuidador te hará preguntas sobre horarios de comida, juguetes favoritos y señales de estrés. Esa curiosidad es síntoma de profesionalidad.

## Parques, paseos y vida diaria en la ciudad

Madrid tiene zonas verdes magníficas: Casa de Campo, El Retiro (con zonas permitidas para perros), Madrid Río y parques de barrio. Respeta correas, recoge deposiciones y lleva agua en verano. En agosto el asfalto quema: evita horas centrales del día.

Conoce la **normativa municipal**: hay razas que requieren bozal, y en transporte público suelen exigir transportín o correa corta según el tamaño del animal.

## Emergencias y veterinarios

Guarda en el móvil la dirección de una **clínica 24 horas** cercana a tu alojamiento. Urgevet y varios hospitales de referencia atienden urgencias. Si tu mascota tiene patologías crónicas, localiza también una farmacia veterinaria en tu barrio.

## Reservar con garantía

Tanto el alojamiento como el cuidador deben quedar **documentados en la reserva**: fechas, precio, política de cancelación. Pagar dentro de Home&Heart activa pago protegido y, si hay cancelación tardía, la garantía de alternativa verificada.

## Conclusión

Viajar con mascotas a Madrid es totalmente viable si planificas transporte, alojamiento y apoyo local. Combina un **alojamiento pet-friendly en Madrid** con un cuidador de confianza para las horas en que no puedas estar con ella. Tu perro o gato también merece vacaciones sin estrés.

[Descubre cuidadores de mascotas en Madrid](/madrid/mascotas) y reserva online en minutos.`,
    publicado: true,
    featured: false,
  },
  {
    slug: "que-es-nru-alojamiento-turistico",
    titulo: "Qué es el NRU y por qué debes exigirlo",
    subtitulo:
      "Todo lo que necesitas saber sobre el Número de Registro Único en alquileres turísticos",
    categoria: "alojamiento",
    tags: ["NRU", "alojamiento", "legal", "seguridad"],
    contenido: `Si has reservado un piso turístico en los últimos años, es posible que hayas visto un código llamado **NRU** (Número de Registro Único) en el anuncio. No es un detalle menor: en España el registro es obligatorio para muchos alquileres de corta estancia, y reservar sin él puede convertir tu escapada en un problema legal o incluso en una cancelación de última hora.

## Qué es exactamente el NRU

El NRU es el identificador que las viviendas de uso turístico obtienen al inscribirse en el registro autonómico correspondiente. Demuestra que el alojamiento cumple requisitos mínimos de seguridad, habitabilidad y comunicación a las autoridades. Cada comunidad autónoma gestiona su propio registro, pero el principio es el mismo: **sin registro, no hay alquiler legal** en la modalidad turística.

En Madrid, Barcelona, Valencia y otras ciudades con alta presión turística, la inspección es cada vez más frecuente. Los portales y las plataformas serias muestran el número o confirman que el anfitrión lo ha aportado.

## Por qué deberías exigirlo como viajero

Reservar un alojamiento sin NRU implica riesgos:

- **Cancelación administrativa**: la vivienda puede ser clausurada y tu reserva anulada sin compensación clara
- **Seguros**: algunas pólizas de viaje no cubren estancias en alojamientos irregulares
- **Seguridad física**: un piso registrado ha pasado controles básicos de extintores, salidas de emergencia o aforo

No se trata de alarmismo: la mayoría de anfitriones profesionales están correctamente registrados. El problema son los anuncios opacos en redes sociales o chats privados que evitan dar datos.

## Cómo comprobar que el NRU es real

Pide el número completo antes de pagar. Búscalo en el registro público de la comunidad autónoma si existe consulta online. Desconfía si el anfitrión dice que «está en trámite» durante meses o cambia de excusa.

En Home&Heart verificamos documentación de proveedores de **alojamiento**, incluido el NRU cuando aplica. Eso no sustituye tu sentido común, pero filtra perfiles que no aportan papeles.

## NRU, vecinos y convivencia

El registro también limita el impacto en edificios residenciales: hay techos de noches, censos y tasas que financian servicios locales. Alquilar en negro perjudica a vecinos y a anfitriones que sí cumplen la ley. Como huésped, elegir alojamiento registrado es una forma de viajar de manera responsable.

## Relación con seguros y responsabilidad civil

Muchos anfitriones registrados contratan **seguro de responsabilidad civil** para huéspedes. Si ocurre un daño accidental, hay marco para reclamar. En pisos sin registro ni contrato claro, la situación se complica enormemente.

## Qué hacer si el anuncio no muestra NRU

Pregunta directamente. Si no hay respuesta satisfactoria, sigue buscando. El ahorro de unos euros no compensa quedarte sin piso a la llegada. Usa buscadores que permitan filtrar alojamientos verificados y lee reseñas de viajeros recientes.

## Home&Heart y los alojamientos verificados

Nuestra apuesta es sencilla: **solo promovemos alojamiento con documentación revisada**, precio transparente y pago protegido. Si el anfitrión cancela con menos de 24 horas, la Garantía Home&Heart trabaja para encontrarte alternativa en unos 30 minutos.

## Conclusión

El NRU no es burocracia vacía: es la prueba de que tu alojamiento turístico existe legalmente y cumple reglas mínimas. Antes de pagar, exige el número, comprueba su validez y reserva en plataformas que verifiquen a sus anfitriones. Dormirás más tranquilo — con o sin mascota a tu lado.

[Busca alojamiento verificado en Madrid](/madrid/alojamiento) con NRU y reserva inmediata.`,
    publicado: true,
    featured: false,
  },
  {
    slug: "consejos-viaje-ninos-pequenos",
    titulo: "10 consejos para viajar con niños pequeños",
    subtitulo:
      "De la planificación al regreso: cómo hacer que el viaje sea un éxito",
    categoria: "familias",
    tags: ["familias", "niños", "viaje", "consejos"],
    contenido: `Viajar con niños pequeños puede ser maravilloso y agotador a partes iguales. La clave no es tener suerte, sino **anticipar**: ritmos más lentos, más equipaje, más pausas y, a veces, apoyo extra de una niñera o de un alojamiento realmente preparado para familias. Estos diez consejos nacen de experiencias reales de padres que viajan a menudo por España y Europa.

## 1. Ajusta expectativas (y horarios)

Un día «productivo» con un bebé de 18 meses no es ver cinco museos. Es un parque, una siesta larga y una cena tranquila. Planifica **una actividad principal al día** y deja huecos sin agenda. Los niños regulan mejor si mantienes horarios de comida y sueño parecidos a los de casa.

## 2. Elige alojamiento con espacio real

Un estudio céntrico parece ideal hasta que el carrito, la trona y las bolsas de juguetes ocupan cada centímetro. Busca **apartamento con habitación separada**, lavadora y cocina básica. Si viajas con mascota, confirma que el piso es pet-friendly y pregunta por escaleras o ascensor — el carrito ya pesa lo suyo.

## 3. Empaca menos, pero mejor

Lista de imprescindibles: botiquín, medicación habitual, cargadores, snacks familiares, botella de agua reutilizable y una prenda de abrigo extra. Los juguetes rotan: tres favoritos bastan. El resto se reemplaza con libros de viaje o audio cuentos.

## 4. Prepara el trayecto como un proyecto

Ya sea coche, tren o avión, prepara **bolsa de mano de emergencia**: toallitas, cambio completo, bolsas de basura, auriculares infantiles y algo de sorpresa que solo saques a mitad de camino. En avión, pide asiento con espacio para piernas si puedes.

## 5. Apóyate en redes locales

Una **niñera en Madrid** o en la ciudad que visites, contratada por horas, te permite cenar en pareja o asistir a un evento sin culpa. Reserva con antelación en temporada alta y verifica referencias. En Home&Heart, antes de activar un perfil de niñera revisamos DNI, antecedentes penales, certificado de delitos sexuales y mayoría de edad.

## 6. Comida: flexibilidad con límites

Probar gastronomía local es parte del viaje, pero un niño hambriento a las 19:00 no esperará al restaurante de moda que abre a las 21:30. Ten siempre **plan B**: supermercado, fruta, yogurt. Pregunta en alojamientos si hay trona o microondas.

## 7. Seguridad en destino

Identifica el hospital pediátrico más cercano, lleva tarjeta sanitaria europea o seguro de viaje con cobertura infantil y fotografía documentos por si pierdes la cartera. En playa o montaña, protector solar y gorra son obligatorios, no accesorios.

## 8. Involucra a los niños en decisiones pequeñas

«¿Parque o mercado esta mañana?» da sensación de control y reduce rabietas. Un cuaderno de pegatinas del viaje o colección de sellos mantiene la motivación en colas y esperas.

## 9. Ten plan para días de lluvia

Cartas, manualidades en el alojamiento, museo interactivo o piscina cubierta. Madrid, por ejemplo, ofrece opciones bajo techo todo el año. Evita depender solo de planes al aire libre.

## 10. Documenta sin obsesionarte

Las fotos bonitas están bien, pero los mejores recuerdos a veces son una tarde aburrida en el sofá del piso de alquiler viendo dibujos en idioma extraño. Viajar en familia es también eso: **presencia**, no solo turismo intensivo.

## Bonus: reservas y cancelaciones

Cuando reservas alojamiento o cuidado infantil, usa plataformas con **pago protegido y política de cancelación clara**. Si algo falla a última hora, la Garantía Home&Heart puede proponerte alternativas verificadas rápidamente.

## Conclusión

Viajar con niños pequeños mejora cuando dejas de copiar itinerarios de adultos sin hijos. Más espacio, más pausas, apoyo puntual de una niñera Madrid u otra ciudad, y alojamiento pensado para familias. Con eso, el viaje deja de ser supervivencia y vuelve a ser aventura compartida.

[Encuentra apoyo para familias en Madrid](/madrid/nineras) y reserva con tranquilidad.`,
    publicado: true,
    featured: false,
  },
  {
    slug: "garantia-cancelacion-alojamiento",
    titulo: "Qué hacer si tu alojamiento cancela a última hora",
    subtitulo:
      "La Garantía Home&Heart te protege con una alternativa verificada en 30 minutos",
    categoria: "consejos",
    tags: ["garantía", "cancelación", "consejos"],
    contenido: `Recibes el mensaje la noche anterior o, peor, al llegar a la estación: tu alojamiento ha cancelado. Overbooking, avería, clausura administrativa o simplemente mala praxis. Sin un plan, la familia acaba recorriendo hoteles con maletas y niños cansados. Por eso existe la **Garantía Home&Heart**: un protocolo claro cuando la cancelación ocurre con menos de 24 horas de antelación.

## Por qué siguen ocurriendo cancelaciones

Aunque las plataformas han endurecido normas, siguen existiendo anfitriones que venden en varios sitios a la vez, no actualizan calendarios o alquilan fuera de la legalidad sin NRU. Cuando las autoridades actúan o aparece otro huésped con reserva duplicada, tú pagas el precio del caos.

La prevención empieza al reservar: elige **alojamiento verificado**, lee reseñas recientes, confirma dirección exacta y guarda capturas del anuncio y del pago.

## Qué cubre la Garantía Home&Heart

Si tu reserva confirmada en Home&Heart se cancela con menos de 24 horas:

1. Activas la garantía desde tu panel o contactando soporte
2. Nuestro equipo busca **alternativas verificadas** en la misma ciudad o zona cercana
3. Objetivo: proponerte opción viable en unos **30 minutos**, según disponibilidad real

La alternativa puede no ser idéntica al piso soñado, pero sí un alojamiento revisado, con contrato claro y sin pagar dos veces por la misma noche.

## Qué debes hacer tú en los primeros minutos

- Guarda todos los mensajes con el anfitrión
- No canceles tú la reserva sin hablar con soporte si quieres activar la garantía
- Ten a mano número de viajeros, mascotas y presupuesto máximo
- Si viajas con niños, indica edades y necesidades (cuna, trona)

Mientras llega la alternativa, un café con wifi o una zona de consigna puede salvarte el ánimo. Ten lista una lista corta de barrios aceptables para no perder tiempo.

## Si la cancelación es con más de 24 horas

Suele aplicarse la **política de cancelación** del anuncio: reembolso total, parcial o crédito según condiciones. Léelas antes de pagar. Las tarifas no reembolsables son más baratas, pero arriesgadas si tus planes pueden cambiar.

## Aloojamiento, niñeras y cuidadores: misma filosofía

La garantía no es solo para pisos turísticos. Si tu **niñera Madrid** cancela el mismo día de una boda o tu cuidador de mascotas falla antes de un vuelo, el mismo principio aplica: buscar reemplazo verificado rápido dentro de la plataforma.

## Cómo maximizar tus probabilidades de éxito

- Reserva con antelación en festivos y ferias
- Activa notificaciones en la app
- Guarda teléfono de soporte en favoritos
- Considera un segundo plan informal (hotel cadena con cancelación flexible) en viajes críticos

## Transparencia y aprendizaje

Cada cancelación tardía penaliza al proveedor en nuestro sistema de reputación. Los repetidores pierden visibilidad o son expulsados. Así alineamos incentivos: los buenos anfitriones permanecen, los irresponsables no tienen espacio.

## Conclusión

Una cancelación a última hora no debería arruinar tu viaje. Con reserva en Home&Heart, pago protegido y **Garantía de 30 minutos**, pasas de la impotencia a un plan concreto. Antes de reservar fuera, valora el coste real de quedarte sin red de seguridad.

[Busca alojamiento en Madrid](/madrid/alojamiento) con garantía incluida y duerme tranquilo.`,
    publicado: true,
    featured: false,
  },
];
