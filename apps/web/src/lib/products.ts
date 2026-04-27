export type ProductMeta = {
  slug: "energy" | "sleep" | "glow" | "shield" | "zen" | "woman";
  name: string;
  image: string;
  tagline: string;
  quote: string;
  color: string;
  ink: string;
  bg: string;
  popular?: boolean;
  ingredients: string[];
  tags: string[];
};

export const NOVA_PRODUCTS: ProductMeta[] = [
  {
    slug: "energy",
    name: "Energy",
    image: "/products/Energy.webp",
    tagline: "Energía celular sostenida",
    quote: '"Tu día no para. Tu energía tampoco."',
    color: "#83B5F4",
    ink: "#1A5C9A",
    bg: "#EBF4FB",
    ingredients: ["Vitamina C", "L-Carnitina", "Té verde", "Ginseng", "B2", "Ácido Fólico", "Vitamina E"],
    tags: ["Energía sostenida", "Sin picos"],
  },
  {
    slug: "sleep",
    name: "Sleep",
    image: "/products/Sleep.webp",
    tagline: "Sueño profundo y reparador",
    quote: '"Porque descansar también es cuidarse."',
    color: "#1EB1BC",
    ink: "#0F6B5C",
    bg: "#E4F4F4",
    ingredients: ["Triptófano", "Magnesio", "Inositol", "B6", "Glicina"],
    tags: ["Descanso nocturno", "Sin somníferos"],
  },
  {
    slug: "glow",
    name: "Glow",
    image: "/products/Glow.webp",
    tagline: "Belleza desde adentro",
    quote: '"La piel también refleja cómo te cuidas."',
    color: "#F25C54",
    ink: "#B83525",
    bg: "#FAF0EE",
    popular: true,
    ingredients: ["Vitamina C", "Ácido Hialurónico", "Colágeno", "Biotina", "B3", "Centella Asiática", "Vitamina E"],
    tags: ["Desde adentro", "Constancia"],
  },
  {
    slug: "shield",
    name: "Shield",
    image: "/products/Shield.webp",
    tagline: "Fortaleza inmune natural",
    quote: '"Tu rutina de cuidado empieza hoy, no cuando algo pasa."',
    color: "#FFA849",
    ink: "#8C6000",
    bg: "#FAF6E9",
    ingredients: ["Vitamina C", "Zinc", "D3", "Vitamina E", "Niacinamida"],
    tags: ["Cuidado preventivo", "Uso diario"],
  },
  {
    slug: "zen",
    name: "Zen",
    image: "/products/Zen.webp",
    tagline: "Calma mental diaria",
    quote: '"El equilibrio que no se ve, pero se siente."',
    color: "#4E82BC",
    ink: "#2A5490",
    bg: "#EBF0F9",
    ingredients: ["Triptófano", "Magnesio", "Taurina", "Manzanilla", "B6"],
    tags: ["Calma funcional", "Días intensos"],
  },
  {
    slug: "woman",
    name: "Woman",
    image: "/products/Woman.webp",
    tagline: "Bienestar hormonal femenino",
    quote: '"Escucharte también es una forma de cuidarte."',
    color: "#C693C4",
    ink: "#6B3080",
    bg: "#F3EBF9",
    ingredients: ["Extracto de Soya", "B6", "Magnesio", "Ácido Fólico", "Hierro"],
    tags: ["Bienestar femenino", "Ritmos naturales"],
  },
];

export const RETAIL_PRICE = 750;
export const SUB_DISCOUNTS = { 30: 0.20, 60: 0.15, 90: 0.10 } as const;
