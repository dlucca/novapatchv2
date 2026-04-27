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

export const PRODUCTS_CONTENT = {
  energy: ENERGY,
  sleep: SLEEP,
  glow: GLOW,
} as Record<Slug, ProductContent>;

export function getProductContent(slug: string): ProductContent | undefined {
  return (PRODUCTS_CONTENT as Record<string, ProductContent>)[slug];
}
