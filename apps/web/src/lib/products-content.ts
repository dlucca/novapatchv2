import type { ProductMeta } from "@/lib/products";

type Slug = ProductMeta["slug"];

export type LucideIconName =
  | "Sun"
  | "Moon"
  | "Sparkles"
  | "Shield"
  | "Heart"
  | "Coffee"
  | "Sunrise"
  | "Wind"
  | "Leaf";

export type FaqItem = { q: string; a: string };

export type ProductContent = {
  slug: Slug;
  hero: { eyebrow: string; headline: string; subhead: string };
  problem: { eyebrow: string; title: string; lead: string; bullets: string[] };
  target: {
    primary_eyebrow: string;
    primary: string[];
    not_for_eyebrow: string;
    not_for: string[];
  };
  moments: {
    eyebrow: string;
    title: string;
    items: { icon: LucideIconName; title: string; desc: string }[];
  };
  formula: {
    eyebrow: string;
    title: string;
    lead: string;
    ingredients: { name: string; role: string }[];
  };
  science: { eyebrow: string; title: string; lead: string };
  promises: {
    promise_eyebrow: string;
    promise: string[];
    not_promise_eyebrow: string;
    not_promise: string[];
  };
  claims: { eyebrow: string; items: string[] };
  faq: FaqItem[];
  tagline: string;
};

const ENERGY: ProductContent = {
  slug: "energy",
  hero: {
    eyebrow: "Energía celular sostenida",
    headline: "Energía que acompaña tu día",
    subhead: "Energía que acompaña tu día, no que lo sacude.",
  },
  problem: {
    eyebrow: "El reto real",
    title: "No querés estar acelerada. Querés rendir sin estrellarte.",
    lead: "El cansancio acumulado, los bajones de media tarde y la dependencia del café no se resuelven con más estímulo. Se resuelven con energía progresiva, que no exija horarios ni rituales complicados.",
    bullets: [
      "Cansancio acumulado que el café ya no resuelve",
      "Bajones de media mañana o media tarde",
      "Dependencia del café para arrancar y sostener",
      "Sensación de funcionar siempre justo",
    ],
  },
  target: {
    primary_eyebrow: "Hecho para vos si…",
    primary: [
      "Tenés rutinas intensas y días largos",
      "Trabajás muchas horas y entrenás cuando podés",
      "Querés foco mental sin alterar el sueño",
      "Buscás reducir el café o los energizantes",
      "Tenés sensibilidad gástrica a suplementos",
    ],
    not_for_eyebrow: "No es para vos si…",
    not_for: [
      "Buscás un golpe inmediato tipo pre-workout",
      "Esperás que te cambie el día en 10 minutos",
      "Querés un estimulante extremo",
      "Te interesa la lógica fitness hardcore",
    ],
  },
  moments: {
    eyebrow: "Cuándo se usa",
    title: "Para sostener tu día, no para sacudirlo",
    items: [
      {
        icon: "Sunrise",
        title: "Al inicio del día",
        desc: "Lo pegás cuando arrancás y te acompaña sin tener que pensarlo.",
      },
      {
        icon: "Coffee",
        title: "En jornadas largas",
        desc: "Para días de poco descanso, viajes o turnos exigentes sin sumar otra taza.",
      },
      {
        icon: "Heart",
        title: "Energía sostenida",
        desc: "Foco y claridad durante varias horas, sin picos bruscos ni caídas.",
      },
    ],
  },
  formula: {
    eyebrow: "La fórmula",
    title: "Un parche, ingredientes pensados para pasar por la piel",
    lead: "Cada ingrediente fue elegido bajo la regla de los 500 Daltons, el criterio que define qué moléculas pueden atravesar la piel. La liberación es progresiva: nada de picos ni caídas.",
    ingredients: [
      { name: "Vitamina C", role: "Apoya el metabolismo energético" },
      { name: "L-Carnitina", role: "Ayuda a aprovechar las grasas como energía" },
      { name: "Té verde", role: "Aporta cafeína suave y antioxidantes" },
      { name: "Ginseng", role: "Acompaña el rendimiento cotidiano" },
      { name: "B2", role: "Contribuye al metabolismo normal" },
      { name: "Ácido Fólico", role: "Apoya la formación celular" },
      { name: "Vitamina E", role: "Antioxidante de cada día" },
    ],
  },
  science: {
    eyebrow: "La ciencia",
    title: "La regla de los 500 Daltons",
    lead: "La piel es un órgano activo: deja pasar moléculas pequeñas cuando están bien formuladas. Por eso no todo suplemento oral funciona en un parche. En Novapatch, cada fórmula se diseña desde cero para uso a través de la piel, con liberación sostenida durante varias horas.",
  },
  promises: {
    promise_eyebrow: "Te promete",
    promise: [
      "Acompañar tu energía diaria",
      "Ayudarte a sostener el foco",
      "Ser fácil de usar",
      "Integrarse a una rutina real",
      "Energía sin picos bruscos",
    ],
    not_promise_eyebrow: "No te promete",
    not_promise: [
      "Curar fatiga crónica",
      "Reemplazar el descanso",
      "Reemplazar la alimentación",
      "Efectos instantáneos o extremos",
    ],
  },
  claims: {
    eyebrow: "Por qué Novapatch Energy",
    items: [
      "Energía sostenida",
      "Sin picos ni caídas",
      "Ayuda a mantener el foco",
      "Ideal para días largos",
      "Alternativa simple al café",
    ],
  },
  faq: [
    {
      q: "¿Reemplaza al café?",
      a: "No lo reemplaza, lo acompaña. Energy está pensado para sostener tu energía durante el día sin sumar otra taza, y muchas personas lo usan para reducir su consumo de café gradualmente.",
    },
    {
      q: "¿En cuánto tiempo lo voy a sentir?",
      a: "No es un golpe inmediato como un energizante. Es energía progresiva que se nota a lo largo del día y se vuelve más clara con el uso constante.",
    },
    {
      q: "¿Me va a alterar el sueño?",
      a: "Está formulado para acompañar el día sin generar picos bruscos. No tiene la carga de cafeína de una bebida energética, pero si sos muy sensible recomendamos usarlo durante la mañana.",
    },
    {
      q: "¿Cómo se usa el parche?",
      a: "Lo pegás sobre piel limpia y seca al inicio del día, sin agua ni rituales. Se integra a tu rutina y te acompaña varias horas mientras seguís con lo tuyo.",
    },
  ],
  tagline: "Novapatch Energy no te acelera. Te acompaña.",
};

const SLEEP: ProductContent = {
  slug: "sleep",
  hero: {
    eyebrow: "Sueño profundo y reparador",
    headline: "Bajar el ritmo, dormir mejor",
    subhead: "Dormir mejor no es apagarse, es bajar el ritmo.",
  },
  problem: {
    eyebrow: "El problema",
    title: "El problema no es no dormir. Es no poder desconectar.",
    lead: "Llegás a la noche acelerada, te acostás con la mente activa y dormís sin descansar. Las soluciones fuertes asustan, y las complicadas se abandonan. El descanso empieza antes de acostarse, no como solución de emergencia.",
    bullets: [
      "Llegar a la noche con la cabeza acelerada",
      "Costar desconectar y soltar el día",
      "Dormir, pero no descansar de verdad",
      "Querer mejorar el sueño sin medicación",
    ],
  },
  target: {
    primary_eyebrow: "Hecho para vos si…",
    primary: [
      "Tenés estrés diario y mente intensa",
      "Te cuesta desconectar a la noche",
      "Querés mejorar el descanso sin pastillas",
      "Viajás seguido y se te corre el ritmo",
      "Buscás soluciones simples y sostenibles",
    ],
    not_for_eyebrow: "No es para vos si…",
    not_for: [
      "Buscás un somnífero fuerte",
      "Tenés trastornos de sueño severos o clínicos",
      "Esperás dormirte en minutos",
      "Querés un sedante o solución extrema",
    ],
  },
  moments: {
    eyebrow: "Cuándo se usa",
    title: "El descanso empieza con un gesto",
    items: [
      {
        icon: "Moon",
        title: "Antes de acostarte",
        desc: "Como parte de tu rutina nocturna, sin pantallas ni rituales complejos.",
      },
      {
        icon: "Wind",
        title: "Después de la ducha",
        desc: "Cuando empezás a soltar el día y bajar revoluciones.",
      },
      {
        icon: "Heart",
        title: "Días de mente intensa",
        desc: "Para jornadas con estrés acumulado o cuando viajás y se corre el ritmo.",
      },
    ],
  },
  formula: {
    eyebrow: "La fórmula",
    title: "Un parche pensado para acompañar la transición al sueño",
    lead: "Ingredientes naturales seleccionados bajo la regla de los 500 Daltons —el criterio que define qué moléculas atraviesan la piel— con liberación progresiva durante la noche.",
    ingredients: [
      { name: "Triptófano", role: "Precursor natural de la serotonina" },
      { name: "Magnesio", role: "Apoya la relajación muscular" },
      { name: "Inositol", role: "Acompaña la calma mental" },
      { name: "B6", role: "Cofactor del metabolismo nocturno" },
      { name: "Glicina", role: "Aminoácido vinculado al descanso" },
    ],
  },
  science: {
    eyebrow: "La ciencia",
    title: "Acompaña procesos naturales de descanso",
    lead: "La piel deja pasar moléculas pequeñas cuando están bien formuladas. Sleep no induce el sueño ni se compara con un medicamento: acompaña procesos naturales del cuerpo durante la noche, con liberación progresiva mientras dormís.",
  },
  promises: {
    promise_eyebrow: "Te promete",
    promise: [
      "Acompañar tu descanso nocturno",
      "Ayudarte a bajar el ritmo",
      "Integrarse a tu rutina de noche",
      "Ser fácil de sostener en el tiempo",
      "Apoyo al descanso como hábito",
    ],
    not_promise_eyebrow: "No te promete",
    not_promise: [
      "Dormirte en minutos",
      "Reemplazar tratamientos médicos",
      "Resolver trastornos severos del sueño",
      "Resultados garantizados",
    ],
  },
  claims: {
    eyebrow: "Por qué Novapatch Sleep",
    items: [
      "Acompaña el descanso nocturno",
      "Ayuda a bajar el ritmo",
      "Pensado para la rutina de noche",
      "Dormir mejor como hábito",
      "Sin somníferos",
    ],
  },
  faq: [
    {
      q: "¿Es un somnífero natural?",
      a: "No. Sleep no induce el sueño ni reemplaza medicación: acompaña procesos naturales de descanso para que te resulte más fácil bajar el ritmo a la noche.",
    },
    {
      q: "¿Lo voy a sentir la primera noche?",
      a: "Es un hábito, no un sedante. Algunas personas notan una sensación de calma desde el inicio, pero el valor real aparece con el uso regular como parte de la rutina nocturna.",
    },
    {
      q: "¿Lo puedo usar si viajo y cambio de horario?",
      a: "Sí. Está pensado justamente para acompañar rutinas nocturnas que se desordenan: viajes, jornadas largas o noches de estrés acumulado.",
    },
    {
      q: "¿Cuándo conviene pegarlo?",
      a: "Lo ideal es como parte de tu rutina previa a dormir, después de la ducha o cuando empezás a soltar el día. No depende de horarios estrictos.",
    },
  ],
  tagline: "Dormir mejor empieza bajando el ritmo.",
};

const GLOW: ProductContent = {
  slug: "glow",
  hero: {
    eyebrow: "Belleza desde adentro",
    headline: "Glow no se fuerza, se acompaña",
    subhead: "Glow no es un efecto. Es un proceso.",
  },
  problem: {
    eyebrow: "El problema",
    title: "La piel no mejora con un producto aislado.",
    lead: "Mejora cuando el cuidado se vuelve sostenible. Glow entra ahí: como un hábito simple que se puede mantener en el tiempo, lejos de las soluciones rápidas y las rutinas interminables que se abandonan.",
    bullets: [
      "Buscar soluciones rápidas que no se sostienen",
      "Abandonar rutinas demasiado complejas",
      "Cansarse de tomar cápsulas todos los días",
      "Saltar de producto en producto sin constancia",
    ],
  },
  target: {
    primary_eyebrow: "Hecho para vos si…",
    primary: [
      "Te interesa el cuidado personal sin rituales eternos",
      "Valorás el bienestar integral, no solo lo cosmético",
      "Entendés que la piel refleja el estilo de vida",
      "Ya cuidás tu piel con productos tópicos",
      "Querés una alternativa simple a las cápsulas",
    ],
    not_for_eyebrow: "No es para vos si…",
    not_for: [
      "Buscás un efecto cosmético inmediato",
      "Esperás un “antes y después” en días",
      "Querés promesas anti-age o rejuvenecimiento",
      "Buscás un enfoque estético extremo",
    ],
  },
  moments: {
    eyebrow: "Cuándo se usa",
    title: "Cuidarse no debería ser complicado",
    items: [
      {
        icon: "Sparkles",
        title: "Como hábito diario",
        desc: "La constancia importa más que la perfección. Un solo gesto que se repite.",
      },
      {
        icon: "Sun",
        title: "Después de la ducha",
        desc: "Se integra a tu rutina de la mañana sin sumar pasos ni cápsulas.",
      },
      {
        icon: "Heart",
        title: "Días reales",
        desc: "Viajes, estrés o poco descanso: te acompaña mientras seguís con lo tuyo.",
      },
    ],
  },
  formula: {
    eyebrow: "La fórmula",
    title: "Un parche que acompaña sin sumar otra cápsula",
    lead: "Ingredientes seleccionados bajo la regla de los 500 Daltons, el criterio que define qué moléculas pueden atravesar la piel. Liberación progresiva a lo largo del día, sin tener que pensarlo.",
    ingredients: [
      { name: "Vitamina C", role: "Antioxidante clave del día a día" },
      { name: "Ácido Hialurónico", role: "Apoya la hidratación natural" },
      { name: "Colágeno", role: "Proteína estructural de la piel" },
      { name: "Biotina", role: "Acompaña piel, pelo y uñas" },
      { name: "B3", role: "Niacina, parte del cuidado integral" },
      { name: "Centella Asiática", role: "Botánico tradicional del cuidado" },
      { name: "Vitamina E", role: "Antioxidante que acompaña la piel" },
    ],
  },
  science: {
    eyebrow: "La ciencia",
    title: "La piel como reflejo del bienestar interno",
    lead: "Glow no actúa sobre la piel como una crema: acompaña procesos internos que se reflejan hacia afuera. Las moléculas se eligen para ser compatibles con la absorción a través de la piel, con liberación progresiva durante el día.",
  },
  promises: {
    promise_eyebrow: "Te promete",
    promise: [
      "Acompañar tu bienestar general",
      "Facilitarte la constancia",
      "Integrarse a rutinas reales",
      "Ser fácil de sostener en el tiempo",
      "Bienestar que se refleja en la piel",
    ],
    not_promise_eyebrow: "No te promete",
    not_promise: [
      "Cambios visibles inmediatos",
      "Resultados estéticos garantizados",
      "Reemplazar hábitos básicos",
      "Soluciones mágicas",
    ],
  },
  claims: {
    eyebrow: "Por qué Novapatch Glow",
    items: [
      "Bienestar desde adentro",
      "Pensado para la constancia",
      "Apoyo al cuidado diario",
      "Glow como proceso",
      "Parte de una rutina integral",
    ],
  },
  faq: [
    {
      q: "¿Voy a ver resultados rápido?",
      a: "Glow no es un cosmético: es un hábito. La piel refleja constancia, así que el valor aparece cuando lo sostenés en el tiempo, no de un día para otro.",
    },
    {
      q: "¿Reemplaza a mi rutina de skincare?",
      a: "No la reemplaza, la complementa. Glow trabaja desde adentro mientras tu rutina tópica trabaja desde afuera. Funcionan juntos sin pisarse.",
    },
    {
      q: "¿Puedo usarlo si tomo otros suplementos para piel o pelo?",
      a: "Glow está pensado como alternativa simple a las cápsulas. Si ya tomás suplementos, conviene revisar con tu profesional de confianza para evitar duplicar ingredientes.",
    },
    {
      q: "¿Cómo lo incorporo a mi rutina?",
      a: "Lo pegás después de la ducha sobre piel limpia y seca, una vez al día. No depende de horarios estrictos y no suma una cápsula más a tu mañana.",
    },
  ],
  tagline: "Glow no se fuerza. Se acompaña.",
};

const SHIELD: ProductContent = {
  slug: "shield",
  hero: {
    eyebrow: "Cuidado preventivo diario",
    headline: "Cuidarse antes es cuidarse mejor",
    subhead: "Un gesto diario que acompaña tus defensas naturales sin rituales complicados.",
  },
  problem: {
    eyebrow: "El problema",
    title: "El problema no es enfermarse. Es vivir en modo reactivo.",
    lead: "El cuidado que realmente importa es el que se hace antes. Shield entra como un hábito simple, lejos de las rutinas complejas que se abandonan y de las soluciones que solo aparecen cuando ya te sentís mal.",
    bullets: [
      "Cuidarse solo cuando ya te sentís mal",
      "Abandonar suplementos por falta de constancia",
      "Cansarse de rutinas demasiado complejas",
      "No sostener hábitos preventivos en el tiempo",
    ],
  },
  target: {
    primary_eyebrow: "Hecho para vos si…",
    primary: [
      "Te preocupás por tu bienestar general",
      "Tenés rutinas exigentes y poco tiempo",
      "Buscás prevención, no soluciones de emergencia",
      "Valorás la simplicidad por sobre los rituales",
      "Viajás seguido o cambiás de ritmo",
    ],
    not_for_eyebrow: "No es para vos si…",
    not_for: [
      "Buscás garantías absolutas de no enfermarte",
      "Querés un reemplazo de tratamiento médico",
      "Esperás un efecto inmediato o reactivo",
      "Te interesan los discursos clínicos o alarmistas",
    ],
  },
  moments: {
    eyebrow: "Cuándo se usa",
    title: "Pensado para la prevención cotidiana",
    items: [
      {
        icon: "Sun",
        title: "Al inicio del día",
        desc: "Lo pegás cuando arrancás y te acompaña como parte de tu rutina diaria.",
      },
      {
        icon: "Coffee",
        title: "Épocas de mayor exigencia",
        desc: "Para cambios de estación, viajes o jornadas con poco descanso.",
      },
      {
        icon: "Shield",
        title: "Cuidado constante",
        desc: "Acompaña tus defensas naturales sin tener que pensarlo cada día.",
      },
    ],
  },
  formula: {
    eyebrow: "La fórmula",
    title: "Un parche pensado para acompañarte todos los días",
    lead: "Ingredientes naturales seleccionados bajo la regla de los 500 Daltons —el criterio que define qué moléculas atraviesan la piel— con liberación progresiva durante el día.",
    ingredients: [
      { name: "Vitamina C", role: "Antioxidante clásico del bienestar diario" },
      { name: "Zinc", role: "Mineral esencial del cuidado cotidiano" },
      { name: "D3", role: "Vitamina vinculada al bienestar general" },
      { name: "Vitamina E", role: "Antioxidante que acompaña la rutina" },
      { name: "Niacinamida", role: "Forma de B3 del cuidado integral" },
    ],
  },
  science: {
    eyebrow: "La ciencia",
    title: "Acompaña el funcionamiento natural del cuerpo",
    lead: "Shield no activa ni estimula de forma extrema: acompaña procesos naturales del cuerpo. Las moléculas se eligen para ser compatibles con la absorción a través de la piel, con liberación progresiva durante varias horas.",
  },
  promises: {
    promise_eyebrow: "Te promete",
    promise: [
      "Acompañar tu bienestar diario",
      "Facilitar hábitos preventivos",
      "Integrarse a la rutina sin fricción",
      "Ser fácil de sostener en el tiempo",
      "Cuidado consciente y simple",
    ],
    not_promise_eyebrow: "No te promete",
    not_promise: [
      "Evitar enfermedades",
      "Reemplazar tratamientos médicos",
      "Resultados inmediatos",
      "Protección absoluta",
    ],
  },
  claims: {
    eyebrow: "Por qué Novapatch Shield",
    items: [
      "Acompaña el cuidado diario",
      "Apoyo al bienestar general",
      "Pensado para la prevención cotidiana",
      "Ideal para rutinas exigentes",
      "Cuidado consciente",
    ],
  },
  faq: [
    {
      q: "¿Sirve para no enfermarme?",
      a: "Shield no promete evitar enfermedades ni reemplazar tratamientos médicos. Acompaña el cuidado diario y los hábitos preventivos como parte de una rutina simple y constante.",
    },
    {
      q: "¿Lo uso solo cuando me siento mal?",
      a: "Está pensado al revés: como un gesto diario y constante, no como una solución reactiva. El valor aparece cuando se sostiene en el tiempo, antes de que aparezca el problema.",
    },
    {
      q: "¿Puedo usarlo en viajes o cambios de estación?",
      a: "Sí. Esos son justamente algunos de los momentos donde más se nota la utilidad de tener un hábito de cuidado simple que no dependa de comidas ni cápsulas.",
    },
    {
      q: "¿Cómo se usa el parche?",
      a: "Lo pegás sobre piel limpia y seca al inicio del día. Se integra a tu rutina sin sumar pasos y te acompaña varias horas mientras seguís con lo tuyo.",
    },
  ],
  tagline: "Cuidarse antes es cuidarse mejor.",
};

const ZEN: ProductContent = {
  slug: "zen",
  hero: {
    eyebrow: "Calma funcional cotidiana",
    headline: "Calma para seguir, no para frenar",
    subhead: "Acompaña estados de calma y claridad mental en días intensos, sin desconectarte.",
  },
  problem: {
    eyebrow: "El problema",
    title: "El problema no es el estrés ocasional. Es vivir siempre acelerada.",
    lead: "Funcionar en modo alerta permanente cansa. Las soluciones fuertes te dejan plana, las complicadas se abandonan. Zen entra ahí: como un acompañamiento simple para bajar un cambio sin salir del juego.",
    bullets: [
      "Funcionar en modo alerta permanente",
      "Costar frenar al final del día",
      "Confundir productividad con tensión",
      "Probar soluciones que te dejan desconectada",
    ],
  },
  target: {
    primary_eyebrow: "Hecho para vos si…",
    primary: [
      "Tenés alta carga mental y agenda intensa",
      "Trabajás bajo presión seguido",
      "Buscás equilibrio sin perder foco",
      "Valorás soluciones simples y sostenibles",
      "Practicás mindfulness o yoga de forma casual",
    ],
    not_for_eyebrow: "No es para vos si…",
    not_for: [
      "Buscás un ansiolítico o sedante",
      "Querés reemplazar terapia o medicación",
      "Esperás que desaparezca el estrés del todo",
      "Te interesa una solución terapéutica o clínica",
    ],
  },
  moments: {
    eyebrow: "Cuándo se usa",
    title: "Pensado para días intensos",
    items: [
      {
        icon: "Wind",
        title: "Jornadas exigentes",
        desc: "Para días de mucha demanda mental o tardes largas que no aflojan.",
      },
      {
        icon: "Coffee",
        title: "Antes de momentos clave",
        desc: "Como parte de tu preparación previa a reuniones o presentaciones importantes.",
      },
      {
        icon: "Heart",
        title: "Como hábito diario",
        desc: "Calma sin rituales, integrada a tu rutina mientras seguís con lo tuyo.",
      },
    ],
  },
  formula: {
    eyebrow: "La fórmula",
    title: "Un parche pensado para acompañar el equilibrio diario",
    lead: "Ingredientes naturales seleccionados bajo la regla de los 500 Daltons —el criterio que define qué moléculas atraviesan la piel— con liberación progresiva durante el día.",
    ingredients: [
      { name: "Triptófano", role: "Aminoácido vinculado al equilibrio" },
      { name: "Magnesio", role: "Apoya la relajación natural" },
      { name: "Taurina", role: "Aminoácido del bienestar cotidiano" },
      { name: "Manzanilla", role: "Botánico tradicional de la calma" },
      { name: "B6", role: "Cofactor del metabolismo diario" },
    ],
  },
  science: {
    eyebrow: "La ciencia",
    title: "Acompaña estados, no trata emociones",
    lead: "Zen no es un ansiolítico ni se compara con un fármaco: acompaña estados de calma y equilibrio. Las moléculas se eligen para ser compatibles con la absorción a través de la piel, con liberación progresiva durante varias horas.",
  },
  promises: {
    promise_eyebrow: "Te promete",
    promise: [
      "Acompañar estados de calma",
      "Ayudar a equilibrar el ritmo diario",
      "Facilitar hábitos de bienestar mental",
      "Integrarse a la rutina sin fricción",
      "Calma que te deja presente",
    ],
    not_promise_eyebrow: "No te promete",
    not_promise: [
      "Eliminar el estrés",
      "Reemplazar terapia o medicación",
      "Resultados inmediatos",
      "Desconexión total",
    ],
  },
  claims: {
    eyebrow: "Por qué Novapatch Zen",
    items: [
      "Acompaña estados de calma",
      "Ayuda a equilibrar el ritmo",
      "Bienestar mental cotidiano",
      "Calma funcional",
      "Pensado para días intensos",
    ],
  },
  faq: [
    {
      q: "¿Es un ansiolítico natural?",
      a: "No. Zen no trata ansiedad ni reemplaza terapia o medicación. Acompaña estados de calma y equilibrio como parte de un hábito de bienestar mental cotidiano.",
    },
    {
      q: "¿Me va a dejar dormida o sin foco?",
      a: "Zen está pensado al revés: calma funcional que te deja presente. La idea es bajar un cambio sin desconectarte del trabajo o de lo que estés haciendo.",
    },
    {
      q: "¿Lo puedo usar en días normales o solo cuando estoy estresada?",
      a: "Funciona mejor como hábito diario que como solución de emergencia. Acompaña tanto jornadas exigentes como días más calmos donde querés sostener el equilibrio.",
    },
    {
      q: "¿Cómo se usa el parche?",
      a: "Lo pegás sobre piel limpia y seca cuando arrancás el día o antes de un momento exigente. Se integra a tu rutina sin rituales y te acompaña varias horas.",
    },
  ],
  tagline: "Calma para seguir, no para frenar.",
};

const WOMAN: ProductContent = {
  slug: "woman",
  hero: {
    eyebrow: "Bienestar femenino cotidiano",
    headline: "Cuidarse también es escucharse",
    subhead: "Un parche que acompaña tu bienestar respetando los ritmos naturales del cuerpo.",
  },
  problem: {
    eyebrow: "El problema",
    title: "El bienestar femenino no es lineal. Es cíclico.",
    lead: "El cuerpo vive distintos estados a lo largo del mes y muchas soluciones lo tratan como si fuera igual todos los días. Woman se posiciona desde el acompañamiento y la simplicidad, no desde la corrección ni la medicalización.",
    bullets: [
      "Vivir estados físicos y emocionales distintos cada mes",
      "Soluciones que no se adaptan a esos cambios",
      "Abandonar suplementos por falta de constancia",
      "No querer medicalizar el bienestar diario",
    ],
  },
  target: {
    primary_eyebrow: "Hecho para vos si…",
    primary: [
      "Buscás bienestar sin medicalizarte",
      "Tenés rutinas exigentes y poco tiempo",
      "Valorás soluciones simples y sostenibles",
      "Estás conectada con el autocuidado consciente",
      "Querés una alternativa a las cápsulas",
    ],
    not_for_eyebrow: "No es para vos si…",
    not_for: [
      "Buscás un tratamiento para condiciones médicas",
      "Esperás una promesa hormonal o ginecológica",
      "Querés una solución extrema o clínica",
      "Te interesa una comunicación terapéutica",
    ],
  },
  moments: {
    eyebrow: "Cuándo se usa",
    title: "El bienestar también acompaña los días distintos",
    items: [
      {
        icon: "Moon",
        title: "A lo largo del mes",
        desc: "Pensado para acompañar los distintos momentos del ciclo en la vida real.",
      },
      {
        icon: "Sparkles",
        title: "Días de mayor exigencia",
        desc: "Para jornadas largas, viajes o cambios físicos y emocionales.",
      },
      {
        icon: "Heart",
        title: "Como hábito de autocuidado",
        desc: "Un gesto diario que se adapta a vos, no al revés.",
      },
    ],
  },
  formula: {
    eyebrow: "La fórmula",
    title: "Un parche que respeta los ritmos del cuerpo",
    lead: "Ingredientes naturales seleccionados bajo la regla de los 500 Daltons —el criterio que define qué moléculas atraviesan la piel— con liberación progresiva durante el día.",
    ingredients: [
      { name: "Extracto de Soya", role: "Botánico tradicional del bienestar femenino" },
      { name: "B6", role: "Cofactor del metabolismo diario" },
      { name: "Magnesio", role: "Apoya la relajación natural" },
      { name: "Ácido Fólico", role: "Vitamina del cuidado cotidiano" },
      { name: "Hierro", role: "Mineral esencial del bienestar diario" },
    ],
  },
  science: {
    eyebrow: "La ciencia",
    title: "Acompaña procesos que ya existen",
    lead: "Woman no regula, no corrige, no controla: acompaña. Las moléculas se eligen para ser compatibles con la absorción a través de la piel, con liberación progresiva durante varias horas.",
  },
  promises: {
    promise_eyebrow: "Te promete",
    promise: [
      "Acompañar tu bienestar femenino",
      "Respetar los ritmos del cuerpo",
      "Facilitar hábitos diarios",
      "Integrarse a la rutina sin fricción",
      "Ser fácil de sostener en el tiempo",
    ],
    not_promise_eyebrow: "No te promete",
    not_promise: [
      "Tratar síntomas específicos",
      "Reemplazar tratamientos médicos",
      "Resultados inmediatos",
      "Cambios forzados en el cuerpo",
    ],
  },
  claims: {
    eyebrow: "Por qué Novapatch Woman",
    items: [
      "Acompaña el bienestar femenino",
      "Respeta los ritmos del cuerpo",
      "Apoyo al equilibrio diario",
      "Pensado para el día a día",
      "Bienestar sin medicalizar",
    ],
  },
  faq: [
    {
      q: "¿Regula hormonas o el ciclo?",
      a: "No. Woman no regula, no corrige y no controla: acompaña tu bienestar respetando los ritmos naturales del cuerpo. No reemplaza tratamientos ginecológicos ni promesas hormonales.",
    },
    {
      q: "¿Lo puedo usar todos los días del mes?",
      a: "Sí. Está pensado como hábito diario que acompaña tanto los días más exigentes como los más calmos, respetando los distintos momentos del ciclo en la vida real.",
    },
    {
      q: "¿Sirve para síntomas específicos?",
      a: "Woman no trata síntomas específicos ni reemplaza tratamientos médicos. Acompaña el bienestar femenino general como parte de una rutina simple de autocuidado.",
    },
    {
      q: "¿Cómo se usa el parche?",
      a: "Lo pegás sobre piel limpia y seca una vez al día. Se integra a tu rutina sin sumar cápsulas ni depender de comidas, y te acompaña varias horas.",
    },
  ],
  tagline: "Cuidarse también es respetar los propios ritmos.",
};

export const PRODUCTS_CONTENT = {
  energy: ENERGY,
  sleep: SLEEP,
  glow: GLOW,
  shield: SHIELD,
  zen: ZEN,
  woman: WOMAN,
} as Record<Slug, ProductContent>;

export function getProductContent(slug: string): ProductContent | undefined {
  return (PRODUCTS_CONTENT as Record<string, ProductContent>)[slug];
}
