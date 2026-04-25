# Novapatch — Product Requirements Document

**Versión:** 1.0
**Fecha:** 25 de abril de 2026
**Owner:** Cris
**Estado:** Aprobado para implementación MVP

---

## 1. Resumen ejecutivo

Novapatch es una plataforma de e-commerce wellness que vende parches transdérmicos de vitaminas y nutrientes en formato de compra única y suscripción. El MVP se lanza en México (MXN) y Argentina (ARS) con un catálogo inicial de 6 productos, escalando luego a Brasil, Chile y Colombia dentro del año.

El producto se diferencia de otras plataformas de e-commerce por dos decisiones estructurales:

1. **Stack pragmático sin plataforma de e-commerce.** No se usa Shopify, Medusa ni ninguna plataforma de commerce. Todo el dominio (productos, órdenes, suscripciones, cobros) se modela a medida sobre Next.js + PostgreSQL.
2. **Scheduling de suscripciones controlado en aplicación.** Los cobros recurrentes no dependen del scheduling nativo de Stripe o MercadoPago. La aplicación mantiene control total sobre cuándo se cobra cada suscripción, qué retries se hacen, y cómo se manejan las fallas.

El MVP debe estar listo en aproximadamente 12-14 semanas, con un equipo de 1-2 desarrolladores.

---

## 2. Objetivos y métricas de éxito

### 2.1 Objetivos de producto

| # | Objetivo | Cómo se mide |
|---|---|---|
| O1 | Aceptar pagos únicos y suscripciones en MX y AR el día 1 | 1ª orden one-time + 1ª suscripción exitosa en cada país |
| O2 | Operar suscripciones sin depender del scheduler de gateway | Cobros recurrentes ejecutados desde el worker propio con tasa de éxito > 95% |
| O3 | Permitir gestión completa del negocio desde admin web | Cero accesos directos a DB para operaciones de día a día (orders, fulfillment, descuentos, suscripciones) |
| O4 | Experiencia mobile-first de alto rendimiento | LCP < 2.5s en mobile 4G; Lighthouse mobile > 90 |
| O5 | Escalable a 5+ países sin reescribir | Arquitectura multi-país con `regions` table y abstracción `PaymentProvider` |

### 2.2 Métricas de éxito post-launch

- **Conversión a suscripción** (de visitantes únicos): meta inicial 1.5% mes 1, 2.5% mes 3
- **Tasa de éxito de cobros recurrentes**: > 92% (Stripe MX) / > 88% (MercadoPago AR) — los benchmarks de industria son ~90% para CPG con tarjeta tokenizada
- **Churn mensual de suscripciones**: < 8% mensual (benchmark wellness)
- **Tiempo medio entre fallo de cobro y resolución**: < 7 días (a través de retries automáticos)
- **NPS post-primera entrega**: > 40

### 2.3 No-objetivos del MVP

Son decisiones explícitas de no incluir en el MVP. Cada una se evaluará en fases posteriores.

- Facturación fiscal automática (CFDI MX, AFIP AR) → módulo post-launch
- Notificaciones por WhatsApp / SMS → solo email en MVP
- App móvil nativa
- Programa de referidos
- Chat de soporte en vivo
- Variantes de producto (talle, sabor, etc.) — todos los productos son SKU único
- Roles diferenciados en admin (admin único en MVP)
- Suscripciones con cambio de producto (cancelar y reabrir es la única vía)
- A/B testing infrastructure
- Internacionalización a otros idiomas (solo es-MX y es-AR)

---

## 3. Usuario y contexto

### 3.1 Persona principal: "Daniela"

- Mujer, 28-45, urbana, trabajo de oficina o creativo
- Ingreso medio-alto, gasta entre 800-2000 MXN / 30-70 USD mensual en wellness
- Ya consume vitaminas o suplementos pero le molesta tomar pastillas
- Compra desde mobile en 80% de los casos (Instagram, TikTok como discovery)
- Valora: conveniencia, ciencia detrás del producto, evitar fricción
- Sospecha de: claims exagerados, suscripciones difíciles de cancelar, cobros sorpresa

### 3.2 Casos de uso prioritarios

1. **Compra exploratoria one-time:** Daniela ve un ad, entra al sitio, compra un parche para probar, sin crear cuenta.
2. **Suscripción tras prueba positiva:** después de probar un producto, vuelve, crea cuenta y se suscribe a 1-3 productos en distintas frecuencias.
3. **Carrito mixto:** en una misma transacción, compra un producto one-time como regalo + se suscribe a otro para sí misma.
4. **Gestión de suscripción:** desde la cuenta, pausa una suscripción cuando viaja, cambia su tarjeta cuando le emiten una nueva, o cancela una suscripción que no le sirve.
5. **Admin operativo:** el equipo interno entra a `/admin`, ve órdenes pendientes de despacho, marca como enviadas, ve runs fallidos, genera un código de descuento para una campaña.

---

## 4. Alcance funcional

### 4.1 Catálogo de productos

El MVP lanza con 6 productos. Cada producto es un único SKU sin variantes.

| Slug | Nombre | Tagline | Color | Precio MX (MXN) | Frecuencias |
|---|---|---|---|---|---|
| `energy` | Energy | Energía celular sostenida | #83B5F4 | 750 | 30/60/90 |
| `sleep` | Sleep | Sueño profundo y reparador | #1EB1BC | 750 | 30/60/90 |
| `glow` | Glow | Belleza desde adentro | #F25C54 | 750 | 30/60/90 |
| `shield` | Shield | Fortaleza inmune natural | #FFA849 | 750 | 30/60/90 |
| `zen` | Zen | Calma mental diaria | #4E82BC | 750 | 30/60/90 |
| `woman` | Woman | Bienestar hormonal femenino | #C693C4 | 750 | 30/60/90 |

Precios en AR (ARS) se definen con el equipo previo al lanzamiento de ese mercado.

#### 4.1.1 Estructura de datos del producto

Cada producto guarda en DB: slug, name, tagline, descripción larga, ingredientes (array), tags (array), color principal, color tinta, color fondo, flag `popular`, flag `active`, sort_order, e imágenes asociadas.

El precio NO está en `products` — está en una tabla `region_pricing` con una fila por (producto × región) que contiene `retail_price`, `currency`, y `available_frequencies`. Esto desacopla producto de pricing y permite escalar a más países sin alterar el schema.

### 4.2 Modelo de pricing

#### 4.2.1 Compra única (one-time)

Precio retail por SKU según la región. En MVP: 750 MXN para todos los productos. Sin descuentos automáticos por cantidad.

#### 4.2.2 Suscripciones

El descuento aplicado depende de la **frecuencia elegida por el cliente**, no del producto. Más frecuencia = más descuento (premia compromiso).

| Frecuencia | Descuento | Precio en MX (MXN) | Posicionamiento |
|---|---|---|---|
| Cada 30 días | 15% | 638 | Compromiso alto / rutina diaria |
| Cada 60 días | 10% | 675 | Equilibrio / uso frecuente |
| Cada 90 días | 5% | 712 | Para probar la marca |

Los descuentos se hardcodean en una constante `FREQUENCY_TIERS` en el código. Son iguales en MX y AR. Si en el futuro un país requiere descuentos distintos, se migra a tabla `subscription_tiers` por región.

#### 4.2.3 Códigos de descuento

Tipos soportados en MVP:
- **Porcentaje sobre carrito:** ej. `BIENVENIDA10` = 10% off subtotal
- **Monto fijo sobre carrito:** ej. `100MENOS` = 100 MXN off
- **Free shipping condicional:** ej. `ENVIOGRATIS` = envío gratis si subtotal ≥ 800 MXN

Reglas:
- Un código por orden (no acumulables)
- Aplican solo al subtotal de productos one-time, NO descuentan el costo de la primera entrega de suscripciones (las suscripciones ya tienen su propio descuento)
- Validez por fecha (`valid_from`, `valid_until`), uso máximo total (`max_uses`), uso por cliente (default 1), restricción opcional por país

### 4.3 Carrito y checkout

#### 4.3.1 Carrito

Estado en Zustand persistido en localStorage. Si el cliente está logueado, se sincroniza con el servidor para soportar multi-dispositivo.

Tipos de items en el carrito:
- `one_time`: producto único, cantidad ≥ 1
- `subscription`: producto a suscribir, con `frequency_days` (30, 60 o 90)

El carrito puede tener **mezcla libre**: un mismo producto puede estar como one-time Y como suscripción al mismo tiempo. Por ejemplo: "compro 1 Energy ahora para probar + me suscribo a 1 Energy cada 30 días".

#### 4.3.2 Reglas de checkout

- **Guest checkout permitido** si el carrito tiene SOLO items one-time
- **Login obligatorio** si hay al menos un item de suscripción (para que el cliente pueda gestionar sus suscripciones después)
- El país del checkout se determina por la cookie `country` (detectada por geo o seleccionada manualmente en el header). Esto define la moneda, el gateway, las opciones de envío y los precios.

#### 4.3.3 Cobro inicial

El primer cobro en el momento de compra es **una sola transacción** que incluye:
- Todos los productos one-time
- La primera entrega de cada suscripción (al precio con descuento aplicado)
- Costo de envío
- Aplicación del código de descuento si corresponde

Si el cobro inicial falla, no se crea ninguna suscripción ni orden. Se muestra error al cliente con mensaje claro.

Si el cobro tiene éxito:
- Se crea una `order` con `type = subscription_initial` (si hay items de suscripción) o `one_time` (si no)
- Se crean `order_items` para cada línea
- Se crean filas en `subscriptions` con `next_charge_at = NOW() + frequency_days` para cada item de suscripción
- Se envía email de confirmación
- Se notifica al equipo de fulfillment (vía la queue de admin)

### 4.4 Suscripciones

#### 4.4.1 Ciclo de vida

Estados posibles de una suscripción:
- `active`: cobra normalmente en `next_charge_at`
- `paused`: el cliente la pausó, no se cobra hasta que la reanude
- `past_due`: un cobro recurrente falló, está en proceso de retry
- `canceled`: el cliente la canceló (estado terminal, no se reactiva)

#### 4.4.2 Cálculo de próximas fechas

El `next_charge_at` se calcula sumando `frequency_days` al `next_charge_at` anterior, **no a la fecha real del cobro**. Esto evita que las fechas se desplacen si hubo retry.

Ejemplo: cliente compra el día 1 a las 10:00. `next_charge_at = día 31, 10:00`. El día 31 falla el cobro. Día 32 reintento exitoso. `next_charge_at = día 31 + 30 días = día 61, 10:00` (NO día 62).

#### 4.4.3 Acciones del cliente desde `/account/subscriptions`

| Acción | Comportamiento |
|---|---|
| Pausar | `status = paused`, no se generan runs hasta reanudar |
| Reanudar | `status = active`, `next_charge_at = NOW() + frequency_days` |
| Cancelar | `status = canceled`, `canceled_at = NOW()`. Estado terminal. |
| Actualizar tarjeta | Abre formulario de gateway (Stripe Elements / MP Brick), tokeniza nueva tarjeta, reemplaza `payment_method_id` |

Las acciones de **cambiar fecha del próximo cobro (skip/adelantar)** y **cambiar producto dentro de la suscripción** quedan fuera del MVP.

#### 4.4.4 Manejo de fallas en cobros recurrentes

Cuando un cobro recurrente falla, se aplica esta política de retry desde la base de datos:

1. **Intento 1 falla** → crear nuevo `subscription_run` con `scheduled_for = NOW() + 24h`. Email al cliente: "no pudimos procesar tu cobro, intentaremos de nuevo".
2. **Intento 2 falla** → crear nuevo run con `scheduled_for = NOW() + 48h`. Email recordatorio.
3. **Intento 3 falla** → `status = past_due`, NO se crean más runs automáticos. Email "actualizá tu tarjeta" con link a `/account/subscriptions`.

Cuando el cliente actualiza la tarjeta exitosamente desde `past_due`:
- `status = active`
- `next_charge_at = NOW()` (se reactiva el cobro)
- `failed_attempts = 0`

### 4.5 Pagos

#### 4.5.1 Gateways por país

| País | Gateway | Métodos |
|---|---|---|
| MX | Stripe | Tarjeta crédito/débito, OXXO (cash), SPEI (transferencia) |
| AR | MercadoPago | Tarjeta crédito/débito, MercadoPago wallet |

#### 4.5.2 Tokenización (vault)

Las tarjetas se tokenizan en el gateway en la primera transacción. La aplicación guarda solo el `provider_token` (no datos sensibles de tarjeta). Esto permite cobros recurrentes sin volver a pedir la tarjeta y mantiene a Novapatch en el nivel PCI más liviano (SAQ-A).

#### 4.5.3 Webhooks

Eventos críticos a procesar (ambos gateways):
- `charge.succeeded`: confirmación asincrónica de pago
- `charge.failed`: pago rechazado
- `charge.refunded`: reembolso procesado (manual o automático)
- `charge.dispute.created`: chargeback iniciado por el cliente
- `payment_method.updated`: actualización de tarjeta vía Card Account Updater (Stripe) o equivalente

Cada webhook se persiste en `webhook_events` para idempotencia y debugging. La deduplicación se hace por `(provider, event_id)`.

#### 4.5.4 Reembolsos

- **Total**: revierte el cargo completo, marca la orden como `refunded`
- **Parcial**: revierte un monto específico, queda registrado en `payment_attempts` como evento de refund
- Solo desde admin (no auto-servicio en MVP). El cliente solicita por formulario en `/reembolso` y el equipo decide.

### 4.6 Multi-país y localización

#### 4.6.1 Detección de país

- Middleware en Next.js lee `request.geo.country` (provisto por Vercel)
- Si es MX o AR: setea cookie `country`, sigue normal
- Si es otro país: se muestra modal "Pronto en tu país, dejá tu email" + selector manual para forzar MX o AR (a riesgo del cliente, no se entregará si la dirección de envío no es del país detectado)

#### 4.6.2 Selector manual

Visible siempre en el header. Cambiar país:
- Vacía el carrito (los precios y stock varían por país)
- Cambia la moneda visible
- Cambia los métodos de pago disponibles
- Refresca la página

#### 4.6.3 Idiomas

Solo es-MX y es-AR. Mismo idioma base, copy levemente distinto en algunos lugares (ej: "tarjeta de crédito" vs "tarjeta de crédito" — son iguales, pero referencias culturales y formato de moneda cambian).

### 4.7 Logística y fulfillment

#### 4.7.1 Modelo operativo

Preparación interna en el almacén de Novapatch. El transporte es tercerizado: pickup coordinado con la transportadora o entrega en punto físico.

#### 4.7.2 Estados de fulfillment

- `pending`: orden paga, esperando preparación
- `picking`: el equipo está armando el paquete
- `shipped`: paquete entregado a la transportadora, `tracking_number` registrado
- `delivered`: confirmado por el cliente o por la transportadora (manual en MVP)

#### 4.7.3 Notificaciones automáticas al cliente

| Trigger | Email |
|---|---|
| `pending → shipped` | "Tu pedido fue despachado" + número de tracking |
| `shipped → delivered` | "Tu pedido llegó" (manual desde admin en MVP) |

### 4.8 Comunicaciones

Solo email en MVP. Provider: Resend.

| Evento | Asunto |
|---|---|
| Cuenta creada | "Bienvenido a Novapatch" |
| Orden one-time confirmada | "Recibimos tu orden #XXXXX" |
| Suscripción inicial confirmada | "Tu suscripción está activa" |
| Pedido despachado | "Tu pedido va en camino" |
| Cobro recurrente exitoso | "Tu próxima entrega ya viene" |
| Cobro recurrente fallido (intento 1, 2) | "No pudimos procesar tu cobro" |
| Suscripción a `past_due` | "Tu suscripción está en pausa, actualizá tu tarjeta" |
| Suscripción cancelada | "Tu suscripción fue cancelada" |
| Solicitud de reembolso recibida | "Recibimos tu solicitud" |

Todos los emails usan templates de React Email + brand kit (logo, colores, footer).

### 4.9 Cuentas de usuario

Provider: Clerk. Métodos disponibles:
- Email + password
- Magic link (sign-in sin password)
- Google OAuth
- Apple OAuth (en iOS)

Los datos del cliente se sincronizan a la tabla `customers` (Clerk user_id como FK). Información extra que vive en `customers`:
- Dirección de envío principal (con país, postal, calle, número, ciudad, estado)
- `gateway_customer_ids` (JSON con IDs de Stripe MX, MercadoPago AR, etc.)
- `country` (país de operación, no necesariamente igual al `geo.country`)
- Historial de órdenes y suscripciones (relacional)

---

## 5. Admin

### 5.1 Acceso

URL: `/admin/*`. Protegido por Clerk con rol `admin`. Sin roles diferenciados en MVP — todas las personas con acceso ven todo.

### 5.2 Pantallas

#### 5.2.1 Dashboard

- Revenue MTD por país (MXN, ARS), total convertido a USD para comparación
- Suscripciones activas, suscripciones nuevas en el mes
- Churn 30 días (cancelaciones / activas inicio de mes)
- MRR (Monthly Recurring Revenue) calculado como suma de `unit_price / (frequency_days / 30)` de todas las activas
- Órdenes pendientes de despacho (alerta si > X)
- Runs fallidos en últimas 24h
- Gráfico simple: revenue diario últimos 30 días

#### 5.2.2 Órdenes (`/admin/orders`)

Tabla con filtros: estado pago, estado fulfillment, país, tipo (one-time / subscription_initial / subscription_recurring), rango de fecha, búsqueda por customer email u orden ID.

Detalle de orden incluye:
- Timeline de eventos (pago, despacho, refund, dispute)
- Items detallados con precio unitario y descuentos aplicados
- Datos del cliente y dirección
- Acciones: refund total, refund parcial, marcar como enviada con tracking, agregar nota interna

#### 5.2.3 Suscripciones (`/admin/subscriptions`)

Tabla filtrable. Detalle de suscripción muestra:
- Estado actual + historial de cambios de estado
- Próxima fecha de cobro
- Customer + payment method
- Timeline de runs (todos los `subscription_runs` con su `payment_attempt`)
- Órdenes generadas por esta suscripción
- Acciones: pausar, cancelar, retry manual (crea un `subscription_run` con `scheduled_for = NOW()`)

#### 5.2.4 Clientes (`/admin/customers`)

Buscador por email / nombre / país. Ficha de cliente:
- Datos personales y dirección
- Total LTV (suma de revenue de sus órdenes)
- Lista de órdenes
- Lista de suscripciones (con su estado)
- Notas internas

#### 5.2.5 Productos (`/admin/products`)

CRUD básico: crear, editar (todos los campos), activar/desactivar, ordenar (`sort_order`). Edición de pricing por región es una sub-pantalla.

#### 5.2.6 Códigos de descuento (`/admin/discounts`)

CRUD + métricas:
- Lista de códigos con uso actual / max
- Por código: cuántas veces usado, revenue atribuido (suma de subtotales de órdenes que lo usaron), tasa de conversión (usos / impresiones — métrica futura, MVP solo cuenta usos)

#### 5.2.7 Fulfillment Queue (`/admin/fulfillment`)

Vista específica para el equipo operativo. Solo muestra órdenes con estado `paid + pending`. Ordenadas por antigüedad. Agrupables por país.

Acciones rápidas:
- "Marcar como en preparación" (`pending → picking`)
- "Marcar como enviada" + input de tracking number → `picking → shipped` + dispara email al cliente

#### 5.2.8 Influencer Applications (`/admin/influencers`)

Lista de aplicaciones recibidas vía formulario público. Filtros por estado (`pending`, `approved`, `rejected`), país, tamaño de audiencia. Por aplicación: ver datos completos, marcar como `approved` o `rejected`, agregar nota.

### 5.3 Operaciones que NO hace el admin (MVP)

Para evitar feature creep, estas operaciones se manejan por DB directa o se posponen:
- Crear órdenes manualmente (todas las órdenes vienen del checkout)
- Modificar el `next_charge_at` de una suscripción (solo retry manual)
- Cambiar el producto de una suscripción (no soportado en MVP)
- Crear customers manualmente (todos vienen de Clerk)
- Edit de items en una orden ya creada (hay que cancelar y recrear)

---

## 6. Páginas públicas

### 6.1 Lista completa

| Página | Path | Estática / Dinámica |
|---|---|---|
| Home | `/` | Dinámica (productos desde DB) |
| Suscripciones (Plan Builder) | `/suscripciones` | Dinámica |
| Producto | `/productos/[slug]` | Dinámica |
| Carrito | `/cart` | Dinámica (estado cliente) |
| Checkout | `/checkout` | Dinámica (auth + estado) |
| Confirmación | `/checkout/success` | Dinámica |
| Login | `/login` | Clerk |
| Sign-up | `/sign-up` | Clerk |
| Mi cuenta | `/account` | Dinámica (auth) |
| Mis suscripciones | `/account/subscriptions` | Dinámica (auth) |
| Mis órdenes | `/account/orders` | Dinámica (auth) |
| Garantía | `/garantia` | Estática |
| Contacto | `/contacto` | Form → DB + email |
| Preguntas frecuentes | `/preguntas-frecuentes` | Estática |
| Solicitar reembolso | `/reembolso` | Form → DB + email |
| Nosotros | `/nosotros` | Estática |
| Por qué parches | `/por-que-parches` | Estática |
| Aviso de Privacidad | `/aviso-de-privacidad` | Estática |
| Términos y Condiciones | `/terminos-y-condiciones` | Estática |
| Influencers | `/influencers` | Form → DB + email |

### 6.2 Home

Secciones en orden vertical (estilo DirectionC del design brief):

1. **Navbar** transparente sobre hero oscuro, sólido al hacer scroll
2. **Hero** con auto-rotación de los 6 productos cada 5.5 segundos, pausa al primer click del usuario. Dots indicadores abajo.
3. **Uso diario** (How it works): 3-4 pasos con ilustraciones simples
4. **La ciencia** (Absorption): copy a la izquierda + diagrama interactivo a la derecha mostrando capas de piel y dots animados descendiendo al torrente sanguíneo. Stat chips con `<500 Daltons`, `10-12h`, `0× digestión`. CTA.
5. **Comparativa** Novapatch vs cápsulas/pastillas (tabla)
6. **Elige el tuyo** (Product grid): 6 productos en grid 3×2. Click en cada uno = "agregar al carrito como one-time" directo. Sin selector de frecuencia aquí — para suscribirse el cliente va a `/suscripciones`.
7. **Banner de suscripción** (teaser): CTA "Armá tu suscripción y ahorrá hasta 15%" → link a `/suscripciones`
8. **Social Proof**: testimonios + estrellas. MVP con 6-8 testimonios reales hardcodeados o desde una tabla `testimonials` simple.
9. **FAQ**: 6-8 preguntas frecuentes en accordion
10. **Final CTA**: banner coral con llamado a acción
11. **Footer** con 4 columnas (Comprar, Ayuda, Nosotros, Legal) + Newsletter + redes sociales

### 6.3 `/suscripciones`

Plan Builder mobile-first. Lista vertical de las 6 cards de producto. Cada card:
- Imagen del producto + nombre + tagline + precio retail tachado y precio con descuento
- Toggle para activar/desactivar
- Si activa, se expande inline mostrando selector de frecuencia (30/60/90 días, cada uno con su descuento)

Floating bottom bar fija siempre visible:
- Cantidad de parches activos
- **Total a pagar hoy** (suma de primer cobro de cada suscripción) — número grande
- **≈ promedio mensual** en gris pequeño abajo (ancla psicológica)
- Drawer expandible con desglose por item + savings vs retail
- CTA "Suscribirme"

Al hacer click en "Suscribirme":
- Si no está logueado → redirige a `/login?redirect=/checkout`
- Si está logueado → agrega los items al carrito y va a `/checkout`

### 6.4 `/influencers`

Landing con copy explicando el programa + formulario:

| Campo | Tipo | Requerido |
|---|---|---|
| Nombre completo | text | Sí |
| Email | email | Sí |
| Instagram handle | text | Sí |
| TikTok handle | text | No |
| Tamaño de audiencia (IG followers) | number | Sí |
| País | select (MX, AR, otro) | Sí |
| Nicho | select (wellness, fitness, lifestyle, beauty, food, otro) | No |
| Mensaje | textarea | No |

Submit:
- Inserta en tabla `influencer_applications` con `status = pending`
- Envía email a `influencers@novapatch.com` (configurable) con los datos
- Mensaje de éxito al usuario: "Recibimos tu aplicación, te contactaremos en 5-7 días hábiles"

---

## 7. Requisitos no funcionales

### 7.1 Performance

- LCP mobile < 2.5s en 4G simulado
- TTI mobile < 4s
- Lighthouse score mobile ≥ 90 en Performance, Accessibility, Best Practices, SEO
- First-paint del home antes de 1s con SSR + streaming

### 7.2 Disponibilidad

- Target uptime: 99.5% (≈ 3.6 horas de downtime aceptable por mes)
- El scheduler de cobros NO debe estar caído más de 2 horas seguidas — los cobros se atrasan pero no se pierden
- Backups automáticos de DB cada 24h (Neon PITR cubre esto)

### 7.3 Seguridad

- PCI compliance nivel SAQ-A (delegado a gateways, no se almacena PAN ni CVV)
- HTTPS obligatorio
- Webhooks validados con firma del provider (Stripe-Signature, x-mp-signature)
- Endpoints internos del worker protegidos por shared secret
- Rate limiting en endpoints públicos (login, sign-up, checkout, contact form)
- Secrets en variables de entorno, no en repo
- Sentry sin grabación de datos sensibles (PAN, passwords, emails enmascarados en logs)

### 7.4 SEO

- Meta tags por página (title, description, OG, Twitter)
- `sitemap.xml` generado dinámicamente
- `robots.txt` con allow general, disallow `/admin/*` y `/account/*`
- Structured data: `Product`, `Organization`, `BreadcrumbList`
- URLs limpias y semánticas (`/productos/energy`, no `/p/123`)

### 7.5 Accesibilidad

- WCAG 2.1 AA mínimo
- Contraste de texto cumpliendo ratios
- Navegación por teclado funcional en todos los flows críticos
- Screen reader labels en toggles, botones de iconos, inputs
- Focus states visibles

### 7.6 Compatibilidad

- Mobile: iOS Safari ≥ 15, Chrome Android ≥ 100
- Desktop: Chrome, Safari, Firefox, Edge últimas 2 versiones
- Resolución mínima soportada: 360px de ancho

---

## 8. Stack técnico

### 8.1 Resumen

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| Backend | Next.js API routes + Server Actions |
| Database | PostgreSQL en Neon |
| ORM | Drizzle |
| Auth | Clerk |
| Payments | Stripe (MX), MercadoPago (AR) |
| Email | Resend + React Email |
| Storage | Cloudflare R2 |
| Worker | Node.js process en Railway |
| Scheduler | Cron en Railway disparando endpoint del worker (cada 15 min) |
| Cart state | Zustand + localStorage |
| Forms | React Hook Form + Zod |
| Observability | Sentry (errors), Better Stack o Axiom (logs) |
| Deploy | Vercel (web) + Railway (worker) + Neon (db) |
| Repo | Turborepo monorepo |

### 8.2 Arquitectura de scheduler de cobros

El scheduler es la pieza más crítica del sistema. Diseño:

1. **Cron Railway** (cada 15 min) hace POST a `/internal/process-runs` del worker
2. **Worker** ejecuta:
   - Materializa `subscription_runs` desde `subscriptions` con `next_charge_at <= NOW()` y `status = active`
   - `INSERT ... ON CONFLICT (subscription_id, scheduled_for) DO NOTHING` para idempotencia
   - Toma lote de 50 con `SELECT ... FOR UPDATE SKIP LOCKED`
   - Por cada run: cobra contra el gateway con `idempotency_key = run.id`, registra `payment_attempt`, actualiza estado
3. **Política de retry**: 3 intentos con backoff (24h, 48h, abandona y va a `past_due`)
4. **Idempotency key**: el `run.id` se usa como `idempotency_key` contra Stripe / MP. Si el worker crashea entre cobrar y actualizar DB, el siguiente intento devuelve el cargo original sin duplicar.

Tablas auxiliares:
- `subscription_runs` (subscription_id, scheduled_for, status, started_at, finished_at, order_id, failure_reason, attempt_count) con UNIQUE(subscription_id, scheduled_for)
- `payment_attempts` (subscription_run_id, provider, provider_charge_id, amount, currency, status, provider_response, attempted_at)

### 8.3 Capa `PaymentProvider`

Interfaz unificada implementada por `StripeProvider` y `MercadoPagoProvider`:

```typescript
interface PaymentProvider {
  charge(params: ChargeParams): Promise<ChargeResult>;
  tokenize(rawToken: string): Promise<string>;
  refund(chargeId: string, amount?: number): Promise<RefundResult>;
  getCustomer(customerId: string): Promise<CustomerData>;
  createCustomer(params: CreateCustomerParams): Promise<string>;
}
```

El factory `getProvider(country)` retorna la implementación correcta según el país. Esto permite que la lógica de checkout y de scheduler sea agnóstica al gateway.

---

## 9. Plan de implementación

### 9.1 Sprints

| Sprint | Duración | Foco principal |
|---|---|---|
| 0 | 3-4 días | Setup monorepo, Vercel/Railway/Neon, CI |
| 1 | 1 sem | Schema DB completo, admin shell, CRUD de productos |
| 2A | 4-5 días | Layout, navbar, footer, páginas estáticas, formulario de influencers |
| 2B | 5-6 días | Home (DirectionC) con animaciones (Hero auto-rotación, Absorption con dots) |
| 2C | 3 días | Página de producto + carrito (UI sin checkout) |
| 3 | 1.5 sem | Checkout one-time end-to-end (MX y AR), webhooks, refunds desde admin |
| 4 | 1.5 sem | `/suscripciones` Plan Builder + checkout mixto + account area + gestión de suscripciones |
| 5 | 1.5 sem | Scheduler de cobros recurrentes con retries e idempotencia |
| 6 | 1 sem | Admin operativo completo + Influencer Applications |
| 7 | 1.5 sem | QA, performance, SEO, analytics, launch prep |
| 8 | Ongoing | Soft launch a friends & family, monitoreo, iteración |

**Total: 12-13 semanas + buffer = 14 semanas hasta lanzamiento público**

### 9.2 Dependencias críticas (bloqueantes externos)

1. Cuenta MercadoPago AR aprobada (puede tardar semanas, iniciar día 1)
2. Cuenta Stripe MX activada para producción
3. Términos y Aviso de Privacidad redactados por abogado en MX y AR
4. Logística confirmada: transportadoras seleccionadas, costos por zona
5. Imágenes de producto en alta calidad (los 6 SKUs)
6. Copy final del home, FAQ, sobre nosotros
7. Testimonios reales para social proof (mínimo 6)
8. Contenido inicial del blog/educación (post-launch, no bloqueante MVP)

### 9.3 Riesgos identificados

| Riesgo | Impacto | Mitigación |
|---|---|---|
| MercadoPago AR demora aprobación | Alto: bloquea launch en AR | Iniciar trámite día 1, plan B: lanzar solo MX y sumar AR fast-follow |
| Tarjetas que pasan a `past_due` por vencimiento | Medio: reduce MRR | Implementar Stripe Card Account Updater desde día 1 |
| Costo de Vercel + Neon sube con tráfico | Bajo: márgenes ya consideran | Monitorear, evaluar Cloudflare migration si crece |
| Worker de Railway cae durante cobros | Alto: cobros se atrasan | Alertas en Better Stack, Railway tiene auto-restart, runs no se pierden |
| Dispute / chargeback masivo | Alto: pérdida directa + flag al merchant | Procesos claros de fulfillment, tracking obligatorio, FAQ visible sobre garantía |

---

## 10. Métricas y analytics

### 10.1 Eventos a trackear (PostHog o Vercel Analytics)

- `page_view` (todas)
- `add_to_cart` (one-time o subscription, qué producto)
- `cart_view`
- `checkout_started`
- `checkout_completed` (con valor, tipo, país)
- `subscription_created` (productos, frecuencias)
- `subscription_paused`, `subscription_canceled`, `subscription_resumed`
- `account_viewed`
- `payment_method_updated`
- `coupon_applied` (qué código)
- `influencer_form_submitted`

### 10.2 Dashboard interno

Métricas en el `/admin/dashboard` calculadas en tiempo real desde la DB:
- Revenue MTD por país
- Conversion rate (orders / sessions, requiere PostHog)
- AOV (Average Order Value)
- Suscripciones activas, MRR
- Churn 30 días
- Tasa de éxito de cobros recurrentes (últimos 30 días)
- Órdenes pendientes de fulfillment

---

## 11. Glosario

| Término | Definición |
|---|---|
| SKU | Stock Keeping Unit — unidad única de producto. En MVP, 1 producto = 1 SKU. |
| One-time | Compra única, no recurrente |
| Subscription | Suscripción con cobro recurrente cada 30, 60 o 90 días |
| Frequency | Período entre cobros: 30, 60 o 90 días |
| Subscription Run | Una ejecución programada de cobro de una suscripción |
| Payment Attempt | Un intento concreto de cobrar contra el gateway, asociado a un run |
| Past Due | Estado de una suscripción cuyos retries se agotaron |
| Vault | Mecanismo del gateway para guardar tokens de tarjeta sin que el merchant maneje el PAN |
| PCI SAQ-A | Nivel más liviano de PCI compliance, aplicable cuando no se toca data de tarjeta |
| MRR | Monthly Recurring Revenue — ingresos recurrentes mensualizados |
| AOV | Average Order Value — ticket promedio |
| LTV | Lifetime Value — revenue total esperado de un cliente |
| LCP | Largest Contentful Paint — métrica de performance de Web Vitals |
| Idempotency key | Clave que evita duplicar operaciones si se reintentan |
| `FOR UPDATE SKIP LOCKED` | Mecanismo de Postgres para que múltiples workers tomen filas distintas en paralelo |
