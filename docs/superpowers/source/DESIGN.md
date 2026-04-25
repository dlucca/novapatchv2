# Novapatch — Design System

**Versión:** 1.0
**Fecha:** 25 de abril de 2026
**Fuente:** DirectionC del design brief + ajustes del MVP

Este documento es la fuente de verdad para todas las decisiones visuales de Novapatch. Cubre tokens de color, tipografía, espaciado, componentes, animaciones y patrones específicos del producto.

---

## 1. Principios de diseño

1. **Mobile-first siempre.** El 80% del tráfico viene de mobile. Cualquier diseño se valida primero en 360-414px de ancho.
2. **Calma sobre estímulo.** Wellness premium no grita. Espaciado amplio, jerarquía clara, color para enfocar atención no para decorar.
3. **Ciencia visible, no académica.** Los elementos científicos (Daltons, capas de piel, dots animados) son protagonistas, pero traducidos a lenguaje visual accesible.
4. **Coral como decisión, no como adorno.** El coral (`#E8503A`) se reserva para CTAs y momentos de acción. No es color de relleno.
5. **Consistencia por producto.** Cada uno de los 6 productos tiene su tríada de color (accent, ink, background) y se respeta en toda la experiencia.

---

## 2. Sistema de color

### 2.1 Tokens base — Marca

```css
:root {
  /* Coral — CTAs, accents, momentos de acción */
  --color-coral:        #E8503A;
  --color-coral-light:  #FF7A65;   /* hover */
  --color-coral-dark:   #C43B28;   /* active / pressed */

  /* Navy — texto principal, superficies oscuras (hero, plan summary) */
  --color-navy:         #0D1B35;
  --color-navy-light:   #1D3461;   /* secondary headings */

  /* Ocean — link, primary actions sobre fondos claros */
  --color-ocean:        #005088;
  --color-ocean-light:  #0068AA;
  --color-ocean-dark:   #003D6B;

  /* Sky — secondary accent, decoración */
  --color-sky:          #5BA8D5;
  --color-sky-light:    #B8DDEF;   /* card fills */
  --color-sky-pale:     #EAF5FB;   /* subtle hover */

  /* Teal — diagrams, science accents, savings indicators */
  --color-teal:         #1CB1BC;
  --color-teal-pale:    #E4F4F4;

  /* Gold — patch texture accent (NOVAPATCH pill en diagrama de absorción) */
  --color-gold:         #F5C628;

  /* Lime — offer highlights (uso muy puntual) */
  --color-lime:         #C9D849;
  --color-lime-dark:    #A8B42A;
}
```

### 2.2 Tokens base — Superficies

```css
:root {
  --color-cream:        #FAF7F2;   /* background principal del sitio */
  --color-warm:         #FEF7ED;   /* secciones cálidas */
  --color-blush:        #F8EDEB;   /* footer, sección "La ciencia" */
  --color-surface:      #FAFAFA;   /* cards neutras */
  --color-white:        #FFFFFF;
}
```

### 2.3 Productos — Tríadas de color

Cada producto tiene tres colores que se aplican consistentemente en cards, badges, y backgrounds.

| Producto | Accent (`color`) | Ink (texto) | Background |
|---|---|---|---|
| Energy | `#83B5F4` | `#1A5C9A` | `#EBF4FB` |
| Sleep | `#1EB1BC` | `#0F6B5C` | `#E4F4F4` |
| Glow | `#F25C54` | `#B83525` | `#FAF0EE` |
| Shield | `#FFA849` | `#8C6000` | `#FAF6E9` |
| Zen | `#4E82BC` | `#2A5490` | `#EBF0F9` |
| Woman | `#C693C4` | `#6B3080` | `#F3EBF9` |

**Uso:**
- `accent`: bordes activos de cards, dots indicadores, badges de descuento, drop-shadows de imágenes activas
- `ink`: títulos del producto, números importantes asociados al producto
- `bg`: fondo de cards cuando el producto está activo, fondo de imágenes en estado neutral

### 2.4 Reglas de aplicación

- **Texto principal (body, párrafos)**: `--color-navy` con opacidad 0.72-0.78 (`rgba(13,27,53,0.72)`)
- **Headings principales (h1, h2)**: `--color-navy` 100%
- **Texto secundario / metadatos**: `--color-navy` con opacidad 0.55-0.65
- **Texto sobre fondos oscuros (navy)**: `#FFFFFF` con opacidad 0.85 para body, 100% para headings
- **CTAs primarios**: fondo `--color-coral`, texto blanco
- **CTAs secundarios**: fondo `--color-navy`, texto blanco
- **Links inline**: `--color-ocean`, underline en hover
- **Errores**: `#C43B28` (coral-dark)
- **Success**: `--color-teal`
- **Borders**: `rgba(13,27,53,0.06)` para neutrales, `rgba(13,27,53,0.1)` para énfasis sutil

---

## 3. Tipografía

### 3.1 Familias

| Uso | Familia | Pesos | Cuándo |
|---|---|---|---|
| Display + body principal | **Outfit** | 300, 400, 500, 600, 700, 800, 900 | Default en toda la UI |
| Acentos editoriales | **Newsreader** | 400, 500, 600, 700, 800 | Citas destacadas, frases en `<em>` dentro de h1/h2 |
| Alt display (variante temática) | Bricolage Grotesque | 700 | Reservada — no usar en MVP |

Cargar las dos primeras vía `next/font` con `display: swap`.

### 3.2 Escala tipográfica

```css
/* Display */
--font-display-xl:    clamp(48px, 6vw, 72px);   /* Hero h1 */
--font-display-lg:    clamp(40px, 5vw, 62px);   /* Section h2 grande (Plan builder) */
--font-display-md:    clamp(36px, 4.6vw, 56px); /* Section h2 estándar */
--font-display-sm:    clamp(28px, 3.8vw, 44px); /* Subsection h3 destacado */

/* Headings inline */
--font-h3:            22px;                      /* card title */
--font-h4:            18px;                      /* subhead */

/* Body */
--font-body-lg:       16.5px;                    /* párrafos hero, copy importante */
--font-body:          15px;                      /* default */
--font-body-sm:       13.5px;                    /* metadatos */
--font-caption:       12px;                      /* badges, timestamps */
--font-eyebrow:       11px;                      /* labels arriba de h2 */
```

### 3.3 Letter-spacing

| Tamaño | Valor |
|---|---|
| Display (h1, h2 grandes) | `-0.03em` a `-0.035em` |
| Headings medios | `-0.02em` |
| Body | normal |
| Eyebrows / uppercase labels | `+0.14em` a `+0.18em` |
| Buttons | `-0.01em` |

### 3.4 Line-height

| Uso | Valor |
|---|---|
| Display (h1, h2) | 0.98-1.02 |
| Headings menores | 1.05-1.15 |
| Body | 1.55-1.65 |
| Buttons | 1.0 |

### 3.5 Pesos por jerarquía

- h1, h2 grandes: **900** (extra-black, característico de Outfit)
- h3, h4: 700-800
- Body: 400
- Eyebrows / labels: 700, mayúsculas
- Buttons: 700-800
- Números destacados (precios, stats): 800-900

### 3.6 Eyebrow (label sobre headings)

Patrón visual repetido en todas las secciones:

```html
<div class="flex items-center gap-3 mb-3">
  <span class="h-[3px] w-10 rounded-full bg-teal-500"></span>
  <span class="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-500">
    La ciencia
  </span>
</div>
<h2>...</h2>
```

El color de la línea + texto cambia según contexto (teal para ciencia, coral para CTA, ink-color del producto en cards).

### 3.7 Tratamiento editorial (frases con `<em>`)

En h1 y h2 grandes, las palabras enfatizadas usan **Newsreader italic + coral**. Patrón:

```html
<h2>
  Arma tu rutina.<br/>
  <em class="text-coral italic font-newsreader">A tu ritmo</em>.
</h2>
```

Esto introduce contraste visual y rompe la rigidez del display. Usar con moderación: 1 vez por sección máximo.

---

## 4. Espaciado y layout

### 4.1 Escala de espaciado

Múltiplos de 4px. Tailwind defaults aplicables:

```
0.5 = 2px       4 = 16px        14 = 56px
1   = 4px       5 = 20px        16 = 64px
2   = 8px       6 = 24px        20 = 80px
3   = 12px      8 = 32px        24 = 96px
                10 = 40px        28 = 112px
                12 = 48px        32 = 128px
```

### 4.2 Section padding (vertical)

| Tipo de sección | Mobile | Desktop |
|---|---|---|
| Hero | 80px top / 48px bottom | 100px / 80px |
| Sección estándar | 64px | 120px |
| Sección compacta | 48px | 80px |
| Footer | 56px | 80px |

### 4.3 Container widths

```css
--container-sm:    560px;   /* plan builder mobile bottom bar */
--container-md:    720px;   /* contenido editorial estrecho */
--container-lg:    1200px;  /* layouts de marketing estándar */
--container-xl:    1280px;  /* hero, secciones full */
```

Padding lateral del container:
- Mobile (< 640px): `24px`
- Tablet (640-1024px): `32px`
- Desktop (> 1024px): `48px`

### 4.4 Gaps en grids

| Layout | Gap mobile | Gap desktop |
|---|---|---|
| Product grid (cards) | 16px | 20-24px |
| Footer columns | 32px (vertical) | 40px |
| Plan builder grid | 16px | 32px |
| Form fields | 12px | 16px |

---

## 5. Border radius

```css
--radius-sm:    8px;     /* badges pequeños, chips */
--radius-md:    12px;    /* cards de items en lists, list items */
--radius-lg:    16px;    /* cards medianas, inputs, stat chips */
--radius-xl:    18px;    /* legend cards, info boxes */
--radius-2xl:   22px;    /* containers de sección, dropdowns */
--radius-3xl:   24px;    /* cards principales, plan summary */
--radius-full:  9999px;  /* pills, buttons, dots */
```

**Regla:** las cards principales y los buttons primarios usan `rounded-3xl` (24px) o `rounded-full`. Los inputs y elementos secundarios usan 12-16px. No mezclar más de 2 radios en un mismo bloque visual.

---

## 6. Sombras

```css
/* Cards en estado normal */
--shadow-sm:      0 4px 14px rgba(13,27,53,0.04);

/* Cards activas / hover */
--shadow-md:      0 12px 32px rgba(13,27,53,0.08);

/* Cards destacadas (plan summary) */
--shadow-lg:      0 16px 44px rgba(13,27,53,0.10);

/* Floating bottom bar */
--shadow-xl:      0 24px 64px rgba(13,27,53,0.32);

/* Buttons primarios coral */
--shadow-cta:     0 10px 24px rgba(232,80,58,0.4);

/* Drop shadow producto activo (per-product) */
--shadow-product-active: 0 8px 16px {accent-color}66;
```

**Reglas:**
- Cards en estado neutral: shadow sutil (`--shadow-sm`)
- Cards activas o seleccionadas: shadow más profunda + halo de color del producto (`{accent}33` opacity)
- CTAs coral: siempre con shadow para que floten
- Bottom bar mobile: shadow muy fuerte para separación clara del fondo

---

## 7. Componentes principales

### 7.1 Botones

#### 7.1.1 Primary (coral, action)

```css
background: var(--color-coral);
color: #fff;
padding: 16px 28px;
border-radius: 9999px;
font-family: Outfit;
font-weight: 800;
font-size: 15px;
letter-spacing: -0.01em;
box-shadow: var(--shadow-cta);
transition: all 200ms;

/* Hover */
background: var(--color-coral-light);

/* Active */
background: var(--color-coral-dark);

/* Disabled */
background: rgba(255,255,255,0.1);
color: rgba(255,255,255,0.4);
cursor: not-allowed;
box-shadow: none;
```

#### 7.1.2 Secondary (navy, dark)

Mismo shape, fondo `--color-navy`, texto blanco. Sombra navy en lugar de coral.

#### 7.1.3 Ghost / Tertiary

Sin fondo, solo texto + ícono. Útil para "Saber más", "Ver detalles".

#### 7.1.4 Tamaños

| Size | Padding | Font size |
|---|---|---|
| sm | 10px 18px | 13px |
| md (default) | 14px 22px | 14.5px |
| lg | 16px 28px | 15px |
| xl (hero) | 18px 32px | 16px |

### 7.2 Cards

#### 7.2.1 Product Card (estado neutral)

```css
background: #fff;
border: 2px solid rgba(13,27,53,0.06);
border-radius: 24px;
padding: 24px;
transition: all 250ms cubic-bezier(0.22,1,0.36,1);
box-shadow: var(--shadow-sm);
```

#### 7.2.2 Product Card (estado activo)

```css
background: {product.bg};
border: 2px solid {product.accent};
box-shadow: 0 12px 32px {product.accent}33;
```

La transición debe ser suave (250-300ms) para que se sienta el cambio sin parpadeo.

#### 7.2.3 Plan Summary Card (sticky desktop)

```css
background: var(--color-navy);
color: #fff;
border-radius: 24px;
padding: 28px;
position: sticky;
top: 100px;
box-shadow: var(--shadow-lg);
```

### 7.3 Inputs

#### 7.3.1 Text input default

```css
background: rgba(255,255,255,0.7);     /* sobre fondos cream/blush */
/* o */
background: #fff;                       /* sobre fondos blancos puros */
border: 1px solid rgba(13,27,53,0.15);
border-radius: 9999px;                  /* pill style — característico */
padding: 12px 16px;
font-size: 14px;
color: var(--color-navy);
font-family: Outfit;

/* Focus */
border-color: var(--color-ocean);
outline: 2px solid rgba(0,80,136,0.15);
outline-offset: 2px;
```

#### 7.3.2 Textarea

Mismo estilo pero `border-radius: 16px` (no full pill).

#### 7.3.3 Checkbox / radio

Tamaño 20×20px. Estado activo: fondo `--color-coral` o color del producto si aplica. Check en blanco con stroke 2.5.

### 7.4 Toggle (subscription card)

Característico: pill 44×26px (mobile 50×30px). Track gris en off, color del producto en on. Knob blanco con sombra suave. Animación 200-220ms con easing `cubic-bezier(0.22,1,0.36,1)`.

### 7.5 Eyebrow

Ya documentado en sección 3.6. Es un componente reutilizable, no inline.

### 7.6 Stat chip

```css
background: rgba(255,255,255,0.65);
border: 1px solid rgba(13,27,53,0.1);
border-radius: 16px;
padding: 16px 22px;
min-width: 130px;
```

Estructura: número grande (font-display, 26px, weight 900) + unidad pequeña al lado + label debajo.

Usado en sección "La ciencia" (Daltons, horas, digestión).

### 7.7 Pill / Badge

```css
border-radius: 9999px;
padding: 4px 12px;
font-size: 11px;
font-weight: 800;
letter-spacing: 0.02em;
```

Variantes:
- **Discount**: fondo color del producto, texto blanco (`-15%`, `-10%`, `-5%`)
- **Tag**: fondo `rgba(13,27,53,0.08)`, texto navy
- **Status**: fondo del color correspondiente al estado (teal para active, etc.)

### 7.8 Frequency selector (segmented control)

Grid de 3 botones (`30d`, `60d`, `90d`).

```css
/* Container */
display: grid;
grid-template-columns: repeat(3, 1fr);
gap: 8px; /* mobile */
background: rgba(13,27,53,0.05);
border-radius: 9999px;
padding: 3px;

/* Botón inactivo */
background: transparent;
color: rgba(13,27,53,0.6);
border: none;

/* Botón activo (mobile, expandido) */
background: var(--color-navy);
color: #fff;
border: 2px solid var(--color-navy);
border-radius: 14px;
```

Mobile usa cards independientes con border 2px para mayor área de tap. Desktop usa pill segmentado más compacto.

---

## 8. Animaciones

### 8.1 Easings

```css
--ease-out:           cubic-bezier(0.22, 1, 0.36, 1);   /* default suave */
--ease-spring:        cubic-bezier(0.34, 1.56, 0.64, 1); /* bounce sutil */
--ease-linear:        linear;                             /* solo loops infinitos */
```

### 8.2 Duraciones

| Tipo | Duración |
|---|---|
| Hover sobre buttons / links | 150-200ms |
| Toggle on/off | 200-220ms |
| Card state change (active/inactive) | 250-280ms |
| Drawer open/close | 320-350ms |
| Frequency picker expand | 350ms |
| Hero auto-rotation transition | 600ms |
| Loops infinitos (dots descendentes) | 5000ms (5s) |

### 8.3 Animación signature: dots descendentes (Absorption section)

Esta es la animación más característica del sitio. Dots viajan desde arriba hasta el "torrente sanguíneo" pasando por capas de piel.

```css
@keyframes nc-descend {
  0%   { transform: translateY(0);    opacity: 0; }
  10%  {                              opacity: 1; }
  90%  {                              opacity: 1; }
  100% { transform: translateY(380px); opacity: 0; }
}

.absorption-dot {
  width: 11px;
  height: 11px;
  border-radius: 9999px;
  background: var(--color-teal);
  box-shadow:
    0 0 0 4px rgba(28,177,188,0.22),
    0 0 10px rgba(28,177,188,0.5);
  animation: nc-descend 5s linear infinite;
}
```

6 dots con delays escalonados (0s, 0.6s, 1.4s, 2.2s, 3.1s, 4.0s) y posiciones X variadas (22%, 36%, 52%, 68%, 82%, 44%) para crear sensación de parallax.

### 8.4 Hero auto-rotación

- Auto-cambio cada 5500ms
- Transición entre productos: cross-fade 600ms
- Pausa permanente al primer click del usuario
- Dots indicadores abajo cambian de tamaño (activo más grande)

### 8.5 Bottom bar drawer (mobile)

- Click en el header del bar → expande con `max-height` transition de 350ms
- Chevron rota 180° en 300ms
- Border-top aparece cuando está abierto

### 8.6 Reglas generales

- **No usar libs de animación** en MVP. CSS puro alcanza para todos los casos.
- **Respetar `prefers-reduced-motion`**: animaciones infinitas (dots, hero) se pausan; transiciones se acortan a 0.01ms.
- **Nunca animar `box-shadow` directo**: usar `transform` y `opacity` por performance.

---

## 9. Patrones específicos del producto

### 9.1 Sección "La ciencia" (Absorption)

Layout desktop: 2 columnas. Izquierda copy + 3 stat chips + CTA. Derecha el diagrama.

Diagrama (derecha):
- Container con fondo `#EFE0D6`, border-radius 24px, padding 18px
- Header: "NOVAPATCH" pill amarillo con gradient gold (10×18px padding)
- Subheader: "Liberación controlada · 10–12 horas"
- Track de dots arriba y abajo del pill (decoración)
- Stack de 4 bandas (capas de piel):
  1. **ESTRATO CÓRNEO** (76px alto, navy, wave bottom, chip "< 500 Daltons" en teal)
  2. **EPIDERMIS** (92px, navy, wave bottom)
  3. **DERMIS** (124px, navy, wave bottom, líneas decorativas)
  4. **TORRENTE SANGUÍNEO** (80px, navy más oscuro, label en color rojo `#C44535`, paths SVG simulando flujo sanguíneo)
- Dots animados absolute encima del stack, con animación `nc-descend`

Mobile: el diagrama va abajo del copy, ancho completo.

### 9.2 Hero con auto-rotación

- Fondo: `--color-navy` con detalles sutiles (gradiente o noise pattern)
- Producto activo: imagen grande del parche, su color de accent en glow/aura
- Texto eyebrow + h1 + subhead + CTA (dual: "Suscribirme" coral + "Comprar única vez" ghost)
- Dots indicadores: 6 puntos abajo, el activo es 2x más grande con color del producto activo
- Selector lateral (desktop): cards verticales pequeñas con cada producto, click cambia el activo y pausa la rotación

### 9.3 Plan Builder card mobile

Estructura vertical:
1. **Top row** (siempre visible):
   - Imagen producto 76×76 con padding y bg color del producto
   - Nombre + tagline + precio (retail tachado si activo + precio con descuento + badge `-X%`)
   - Toggle a la derecha
   - Click en cualquier parte del top row toggle el estado
2. **Frequency picker** (visible solo si activo):
   - Border-top dashed con color del producto
   - Label "¿Cada cuánto te llega?"
   - Grid de 3 cards (`30d`, `60d`, `90d`) con número grande + descuento abajo
   - Card activa: fondo `--color-navy`, texto blanco, descuento en color del producto

Animación de expansión: `max-height` de 0 a 200px en 350ms con ease-out.

### 9.4 Floating bottom bar

Documentado en componente. Dimensiones:
- Padding container exterior: 16px
- Max-width: 560px (centrado)
- Border-radius: 24px
- Position: fixed bottom

Contenido:
- Footer siempre visible: 16-22px padding, count + total + "Suscribirme"
- Drawer expandible: lista de items con bg `rgba(255,255,255,0.06)` cards individuales

---

## 10. Iconografía

### 10.1 Set de íconos

**Lucide React** (`lucide-react`). Tamaño default 16px (inline) o 20-24px (standalone).

Íconos más usados:
- `ArrowRight` — CTAs primarios
- `Check` — confirmaciones, listas
- `ChevronDown` / `ChevronUp` — drawers, accordions
- `X` — cerrar modals, drawers
- `ShoppingBag` — carrito
- `User` — cuenta
- `Menu` — nav mobile
- `Star` — ratings
- `Instagram`, `Tiktok` — redes (custom SVG en footer, no Lucide)

### 10.2 Stroke width

Default 2.0. Aumentar a 2.4-2.6 para íconos pequeños sobre fondos coloridos (mayor legibilidad).

### 10.3 Color

- En texto / inline: `currentColor` (hereda del texto)
- Standalone: `--color-navy` con opacidad según jerarquía

---

## 11. Imágenes y assets

### 11.1 Producto (parches)

Cada producto tiene 1 imagen "hero" con fondo transparente. Aspect ratio aproximado 1:1.5 (vertical). Resolución mínima: 800×1200px @2x.

### 11.2 Hero / lifestyle

Lifestyle: 1920×1080 (desktop) y crops 1080×1350 (mobile/IG). Tono cálido, modelos diversas, estética wellness premium pero accesible.

### 11.3 Optimización

- Servir desde Cloudflare R2 + Next.js Image
- Format: WebP con fallback JPEG
- Sizing automático con `next/image` y `sizes` prop apropiado
- Lazy loading default excepto hero LCP

### 11.4 Placeholder strategy

- LQIP (Low Quality Image Placeholder) blur con `placeholder="blur"` en Next.js Image
- Color de fondo en placeholder: matching `--product.bg` para evitar flash blanco

---

## 12. Footer

Estructura 4 columnas + newsletter + bottom rule.

```
┌──────────────────────────────────────────────────────────┐
│  Comprar       Ayuda          Nosotros         Legal     Newsletter│
│  Tienda        Contáctanos    Nosotros         Aviso de  [email]   │
│  Suscripciones FAQ            ¿Por qué         Privacidad [Suscríbirse]│
│  Garantía      Solicitar      parches?         Términos   [IG][TT]│
│                reembolso      Suscríbete y                        │
│                               ahorra                              │
├──────────────────────────────────────────────────────────┤
│  novapatch.            © 2026 Novapatch · Hecho con ciencia.│
└──────────────────────────────────────────────────────────┘
```

- Background: `--color-blush` (`#F8EDEB`)
- Padding: 80px top, 56px bottom (desktop) / 56px / 40px (mobile)
- Mobile: cols se apilan verticalmente, newsletter al final

Logo: `novapatch` en Outfit black (900) con punto coral final (`<span style="color:coral">.</span>`).

---

## 13. Responsive breakpoints

```css
/* Tailwind defaults */
sm:   640px
md:   768px
lg:   1024px
xl:   1280px
2xl:  1536px
```

### 13.1 Reglas

- **Mobile-first**: estilos base son mobile, breakpoints suman para desktop
- **No usar `lg:` para layouts de 2 columnas** que serían incómodos en tablet 1024px. Preferir `xl:` (1280px) para grids complejos
- **Padding de container**: cambia en `sm:` y `lg:`, no en cada breakpoint
- **Font sizes**: usar `clamp()` para fluidez, no múltiples breakpoints

### 13.2 Test devices objetivo

| Device | Width | Por qué |
|---|---|---|
| iPhone SE | 375px | Mínimo realista mobile |
| iPhone 13 | 390px | Mobile típico |
| iPhone 14 Pro Max | 430px | Mobile grande |
| iPad | 768px | Tablet vertical |
| MacBook Air | 1280px | Desktop común |
| Desktop grande | 1440-1920px | Resolución frecuente |

---

## 14. Accesibilidad visual

### 14.1 Contrastes mínimos (WCAG AA)

- Texto normal sobre fondo: 4.5:1
- Texto grande (≥18px o ≥14px bold): 3:1
- Componentes UI (bordes, íconos): 3:1

### 14.2 Combinaciones validadas

| Texto | Fondo | Ratio |
|---|---|---|
| `--color-navy` | `--color-cream` | 13.5:1 ✅ |
| `--color-navy` | `#fff` | 16.2:1 ✅ |
| `#fff` | `--color-navy` | 16.2:1 ✅ |
| `#fff` | `--color-coral` | 4.6:1 ✅ |
| `rgba(13,27,53,0.72)` body | `--color-cream` | 9.7:1 ✅ |
| `rgba(13,27,53,0.55)` muted | `--color-cream` | 7.4:1 ✅ |

### 14.3 Focus states

Todos los elementos interactivos tienen focus visible:
- Outline 2px solid `--color-ocean` con offset 2px
- Excepción: en botones coral, outline blanco con offset interno 2px

### 14.4 Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Excepción: animaciones esenciales (loaders, dots de la sección "La ciencia") se ocultan en lugar de pausarse.

---

## 15. Tailwind config

Tokens a configurar en `tailwind.config.ts`:

```typescript
export default {
  theme: {
    extend: {
      colors: {
        coral: {
          DEFAULT: '#E8503A',
          light: '#FF7A65',
          dark: '#C43B28',
        },
        navy: {
          DEFAULT: '#0D1B35',
          light: '#1D3461',
        },
        ocean: {
          DEFAULT: '#005088',
          light: '#0068AA',
          dark: '#003D6B',
        },
        sky: {
          DEFAULT: '#5BA8D5',
          light: '#B8DDEF',
          pale: '#EAF5FB',
        },
        teal: {
          DEFAULT: '#1CB1BC',
          pale: '#E4F4F4',
        },
        gold: '#F5C628',
        cream: '#FAF7F2',
        warm: '#FEF7ED',
        blush: '#F8EDEB',
        // Product accents
        product: {
          'energy':  { DEFAULT: '#83B5F4', ink: '#1A5C9A', bg: '#EBF4FB' },
          'sleep':   { DEFAULT: '#1EB1BC', ink: '#0F6B5C', bg: '#E4F4F4' },
          'glow':    { DEFAULT: '#F25C54', ink: '#B83525', bg: '#FAF0EE' },
          'shield':  { DEFAULT: '#FFA849', ink: '#8C6000', bg: '#FAF6E9' },
          'zen':     { DEFAULT: '#4E82BC', ink: '#2A5490', bg: '#EBF0F9' },
          'woman':   { DEFAULT: '#C693C4', ink: '#6B3080', bg: '#F3EBF9' },
        },
      },
      fontFamily: {
        display: ['var(--font-outfit)', 'sans-serif'],
        editorial: ['var(--font-newsreader)', 'serif'],
      },
      fontSize: {
        'display-xl': ['clamp(48px, 6vw, 72px)', { lineHeight: '0.98', letterSpacing: '-0.035em' }],
        'display-lg': ['clamp(40px, 5vw, 62px)', { lineHeight: '1.0', letterSpacing: '-0.03em' }],
        'display-md': ['clamp(36px, 4.6vw, 56px)', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
        'eyebrow':    ['11px',  { lineHeight: '1.2',  letterSpacing: '0.18em' }],
      },
      borderRadius: {
        '4xl': '24px',
      },
      boxShadow: {
        'card':         '0 4px 14px rgba(13,27,53,0.04)',
        'card-active':  '0 12px 32px rgba(13,27,53,0.08)',
        'card-hero':    '0 16px 44px rgba(13,27,53,0.10)',
        'bar':          '0 24px 64px rgba(13,27,53,0.32)',
        'cta-coral':    '0 10px 24px rgba(232,80,58,0.4)',
      },
      animation: {
        'nc-descend': 'nc-descend 5s linear infinite',
      },
      keyframes: {
        'nc-descend': {
          '0%':   { transform: 'translateY(0)',     opacity: '0' },
          '10%':  {                                 opacity: '1' },
          '90%':  {                                 opacity: '1' },
          '100%': { transform: 'translateY(380px)', opacity: '0' },
        },
      },
    },
  },
};
```

---

## 16. Checklist de implementación visual

Para cada página/sección nueva, validar antes de PR:

- [ ] Mobile (375px, 414px) y desktop (1280px) renderizan correctamente
- [ ] Tokens de color usados (sin hexcodes hardcodeados)
- [ ] Tipografía respeta jerarquía y pesos del sistema
- [ ] Espaciado usa la escala de 4px
- [ ] Focus states visibles en todos los elementos interactivos
- [ ] Contraste de texto cumple WCAG AA
- [ ] Animaciones respetan `prefers-reduced-motion`
- [ ] Imágenes optimizadas con `next/image` y `sizes` prop
- [ ] Componentes shadcn/ui usados antes de crear custom
- [ ] Lighthouse mobile ≥ 90 (Performance, A11y, Best Practices, SEO)
- [ ] Texto overflow controlado (no breaks raros, balance)
