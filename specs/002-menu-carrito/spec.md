# Spec 002 — Menú y carrito

**Repo:** `mocca-go-front` · **Fecha:** 2026-11-10 · **Estado:** aprobada el 2026-11-10 · v1.1 (las propuestas DP-01 a DP-10 pasan a D-028 a D-036)
**Contrato consumido:** `docs/openapi.json` (back, incrementos 001–019) · **Siguiente paso tras aprobar:** `plan.md` → `tasks.md`

---

## 1. Objetivo

Que cualquier persona (con o sin cuenta) pueda **ver el menú de Mocca Go y armar su carrito**: explorar los productos por categoría, ver el detalle (incluidos los componentes de un combo), agregar cantidades y revisar el total en pesos. El carrito se conserva al recargar y al iniciar sesión. **Todavía no se puede pedir ni pagar:** elegir el punto de entrega, pagar y seguir el pedido es el incremento 3.

## 2. Decisiones ya tomadas

| ID | Decisión | Origen |
|---|---|---|
| D-001 | Solo web responsive (el menú es de móvil primero, pero usable en escritorio). | Usuario |
| D-002 / D-006 | Tailwind + shadcn/ui; datos del servidor con TanStack Query y cliente tipado generado del OpenAPI. | Usuario |
| D-014 / D-016 | El navegador solo habla con `/api/...`; `GET /menu` es una de las 6 rutas públicas de la pasarela (no necesita sesión). | Spec 001 |
| D-022 | Despliegue en Railway. | Usuario |
| D-026 | El nombre visible del cliente sale de `GET /customers/me`. | Usuario |
| D-027 | Paleta y logo aprobados; **solo tokens** de color (`docs/design-tokens.md`). Sobre el ámbar va texto espresso. | Usuario |

## 3. Alcance

**Entra**
- Menú público: lista de productos por categoría, con precio en COP, descripción y estado «Agotado».
- Filtro por categoría («Todo» y las seis del back).
- Detalle del producto: descripción, componentes (si es combo), selector de cantidad y «Agregar».
- Carrito: agregar, cambiar cantidad, quitar, vaciar; total en COP; límites del back (hasta 10 unidades por producto y 10 productos distintos).
- Persistencia local del carrito (solo producto y cantidad) y reconciliación con el menú actual (agotados, precios nuevos, productos retirados).
- Rutas: `/` (menú para todos) y `/cliente/menu` (el mismo menú dentro del marco del cliente); la navegación «Menú» del cliente se habilita.
- Mock de la API ampliado con un menú realista (20 productos, 3 combos, algunos agotados).

**No entra** (otros incrementos)
- Elegir punto de entrega, nota de cocina, pago con tarjeta de demostración, crear el pedido (3).
- Seguimiento en vivo, historial, cancelar (3 y 6); cocina y despacho (4 y 5).
- Fotos de producto (el back no las tiene), tamaños, extras, comisión por método de pago, horario preferido (no existen en el back; ver `docs/notas-mockups.md`).
- Búsqueda de texto (el menú tiene ~23 productos).
- Edición del catálogo (admin, incremento 7).

## 4. Contrato consumido

| Operación | Respuesta relevante | Errores a manejar |
|---|---|---|
| `GET /menu` (pública) | `{ data: MenuItem[] }`. `MenuItem`: `id`, `sku`, `name`, `description`, `category` (`combo`, `cafe`, `bebida`, `panaderia`, `pasteleria`, `snack`), `price` (COP entero), `available`, `components[{name, quantity}]`. Ordenado por categoría y nombre; solo productos activos. | 429 (demasiadas peticiones), 502/504 (back caído o lento). |

**Límites que el carrito debe respetar** (de `CreateOrderDto`, para que el incremento 3 pueda enviarlo tal cual): 1 a 10 líneas, cada una con `productId` y `quantity` de 1 a 10.

**Hallazgos al cruzar el contrato**
- El menú no trae imagen ni opciones por producto: la tarjeta usa un ícono por categoría.
- `available` ya combina «agotado», saldo e inactivo: el front solo lo muestra, no lo calcula.
- El mock actual devuelve `[]` para `/menu`, pero el contrato dice `{ data: [] }`: se corrige en esta spec.
- El precio que muestra el carrito es **informativo**: el back recalcula el total al crear el pedido (incremento 3).

## 5. Decisiones de diseño propuestas (requieren tu visto bueno)

| ID | Propuesta | Alternativa |
|---|---|---|
| DP-01 | **El menú es público** y vive en `/` (con cabecera: «Ingresar» y «Crear cuenta» si no hay sesión, o «Ir a mi panel» si la hay). Los clientes lo usan también desde `/cliente/menu`, dentro de su marco, con el mismo componente. | Menú solo para clientes con sesión (`/cliente/menu`) y `/` queda como portada. Pierde la posibilidad de curiosear antes de registrarse. |
| DP-02 | **El carrito vive en el navegador** (`localStorage`, clave versionada), porque el back no tiene carrito. Guarda `productId`, `quantity` y el último precio visto (solo para poder avisar cambios); nombre, precio y disponibilidad salen siempre del menú actual. Se valida al leerlo; si está dañado o es de otra versión, se descarta. Sin `localStorage` (modo privado) funciona en memoria. | Carrito solo en memoria (se pierde al recargar). |
| DP-03 | **Un visitante puede armar su carrito**; el carrito sobrevive al inicio de sesión. Al **cerrar sesión se vacía** (equipos compartidos del campus). | Exigir sesión para agregar; o conservar el carrito tras cerrar sesión. |
| DP-04 | **El carrito es un panel lateral** (`<dialog>`, igual que el menú móvil: sin dependencias nuevas) que se abre desde un botón con la cantidad. En móvil hay además una **barra inferior** «Ver carrito · 2 · $12.000». | Página aparte `/carrito`. |
| DP-05 | **El detalle del producto es un panel/diálogo** sobre el menú (no una página): descripción, componentes, cantidad y «Agregar». | Página `/menu/[id]`. |
| DP-06 | **El menú se pide desde el navegador** con TanStack Query (`staleTime` 30 s, se refresca al volver a la pestaña), con esqueletos de carga. Así «Agotado» se actualiza sin recargar. | Renderizar en el servidor con revalidación (primer pintado más rápido, disponibilidad menos fresca). |
| DP-07 | **Reconciliación:** al abrir el carrito o cargar el menú se cruzan los productos guardados con el menú. Un producto retirado se quita con aviso; uno agotado se marca y **no cuenta en el total**; un precio nuevo se avisa. «Continuar» queda bloqueado mientras haya productos no disponibles. | Quitar automáticamente lo agotado sin pedir confirmación. |
| DP-08 | **Botón «Continuar»:** el visitante ve «Ingresar para pedir» (lleva a `/login?next=/cliente/menu`); el cliente ve «Continuar» **deshabilitado** con la nota «Disponible pronto» hasta el incremento 3; el personal no ve carrito ni botón de agregar (no compra). | Ocultar el botón hasta el incremento 3. |
| DP-09 | **Pesos y etiquetas:** `Intl.NumberFormat('es-CO', {style: 'currency', currency: 'COP', maximumFractionDigits: 0})` (`$4.500`). Categorías: Combos, Cafés, Bebidas, Panadería, Pastelería, Snacks. | — |
| DP-10 | **Íconos por categoría** (lucide) en lugar de fotos, hasta que el back ofrezca imágenes. | Pedir al back un campo `imageUrl` (cambio fuera de este incremento). |

Aprobadas por el usuario el 2026-11-10 (DP-03: se mantiene la propuesta, ya que conservar el carrito al iniciar sesión no implica cambios pesados). Registradas en `docs/decisions.md` como D-028 a D-036.

## 6. Rutas y comportamiento

| Ruta | Quién | Qué muestra |
|---|---|---|
| `/` | Todos | Menú con cabecera propia (logo, carrito, y «Ingresar» / «Crear cuenta» / «Ir a mi panel»). |
| `/cliente/menu` | Cliente | El mismo menú dentro de `AppShell` (menú lateral, «Salir»). «Menú» deja de decir «Próximamente». |

**Estados del menú:** cargando (esqueletos de tarjetas), vacío («Hoy no hay productos disponibles»), error con «Reintentar» (mensajes de 429 y 502/504 de `describeApiError`), con datos.

**Reglas del carrito**
- Cantidad por producto: 1 a 10; al pasar de 10 se avisa y no se agrega. Hasta 10 productos distintos.
- Un producto agotado no se puede agregar (botón deshabilitado con «Agotado»).
- El total es la suma de `precio × cantidad` de los productos disponibles, en pesos enteros.
- «Vaciar carrito» pide confirmación.
- Cada cambio se anuncia a lectores de pantalla (`aria-live`: «Capuchino agregado. Carrito: 2 productos»).
- Se sincroniza entre pestañas (evento `storage`).

**Persistencia:** clave `mocca-go:cart:v1` con `{ v: 1, lines: [{ productId, quantity, seenPrice }] }`; el aviso de precio nuevo no bloquea y se descarta con «Entendido». Se valida con zod al leer.

**Diseño:** tokens de color de D-027 (sin hex), objetivos táctiles de 44 px, sin desborde horizontal desde 360 px, filtro de categorías como chips con desplazamiento horizontal.

## 7. Criterios de aceptación

| ID | Criterio (verificable) |
|---|---|
| CA-01 | Sin sesión, `/` muestra el menú agrupado por categoría, con nombre, descripción, precio en COP (`$4.500`) y estado; muestra esqueletos mientras carga y no hace falta cookie. |
| CA-02 | Los chips de categoría («Todo» y las seis) filtran la lista; el chip activo se anuncia (`aria-pressed`/`aria-current`) y se opera con teclado. |
| CA-03 | Un producto con `available: false` se ve marcado «Agotado» y no se puede agregar. |
| CA-04 | El detalle muestra descripción y, en un combo, sus componentes con cantidades; permite elegir 1–10 y agregar. |
| CA-05 | El carrito permite agregar, subir/bajar cantidad, quitar y vaciar (con confirmación); respeta 10 unidades por producto y 10 productos distintos con un mensaje claro. |
| CA-06 | El total es exacto en pesos enteros (prueba con precios y cantidades variados) y excluye productos no disponibles. |
| CA-07 | El carrito se conserva al recargar y se sincroniza entre pestañas; datos dañados, de otra versión o con cantidades inválidas se descartan sin romper la página. Sin `localStorage` funciona en memoria. |
| CA-08 | Reconciliación: producto retirado → se quita con aviso; agotado → marcado y fuera del total; precio distinto → aviso; «Continuar» bloqueado mientras queden no disponibles. |
| CA-09 | Un visitante arma su carrito y ve «Ingresar para pedir»; tras iniciar sesión el carrito sigue ahí. |
| CA-10 | Al cerrar sesión el carrito queda vacío. |
| CA-11 | Un cliente ve «Continuar» deshabilitado con «Disponible pronto»; admin, operador y repartidor no ven botones de agregar ni carrito. |
| CA-12 | En 360 px no hay desborde horizontal; la barra inferior resume cantidad y total y abre el carrito; los controles miden al menos 44 px. |
| CA-13 | `/` y `/cliente/menu` muestran el mismo menú; «Menú» del cliente está habilitado y la portada anterior (`Ingresar` / `Crear cuenta` en tarjeta) queda reemplazada por la cabecera. |
| CA-14 | Errores de red: 429 y 502/504 muestran su mensaje con «Reintentar»; el carrito guardado no se pierde por un error del menú. |
| CA-15 | Accesibilidad: paneles con foco atrapado y cierre con Escape, botones con nombre accesible, cambios anunciados, contraste AA con los tokens vigentes. |
| CA-16 | Solo tokens de color (sin hex ni paletas de Tailwind); `check:bundle`, `lint`, `typecheck`, `test`, `build` y `e2e` en verde. |
| CA-17 | Pruebas: unitarias (formato COP, reductor del carrito, límites, reconciliación, lectura de almacenamiento), de componente (tarjeta, detalle, carrito, filtros) y E2E contra el mock con menú realista (explorar, agregar, recargar, agotado, visitante → login, cerrar sesión). |

## 8. Verificación contra el back real

Con el back local y el seed (20 productos, 3 combos):
1. Abrir `/` sin sesión: se ve el menú completo por categorías; los precios coinciden con `GET /menu`.
2. Agregar productos y un combo; recargar: el carrito sigue.
3. Marcar un producto como agotado (operador, `PATCH /products/:id/sold-out`, por Postman) y volver a la pestaña: aparece «Agotado» y, si estaba en el carrito, se avisa.
4. Iniciar sesión como cliente: el carrito sigue; cerrar sesión: queda vacío.

## 9. Riesgos y pendientes

- **Sin fotos:** el menú se verá menos apetitoso que los mockups; se resuelve más adelante con un campo de imagen en el back.
- **Precio informativo:** si el precio cambia entre el carrito y el pedido, el back manda; el incremento 3 debe mostrar el total real.
- **Carrito por navegador:** no viaja entre dispositivos (consecuencia de que el back no tiene carrito).
- **Categorías futuras:** el back podría agregar categorías; el front debe mostrar una desconocida bajo su nombre en bruto en vez de fallar.
- **Mockups:** los de menú/detalle/carrito son borradores; esta spec toma su estructura (pestañas, detalle, carrito) y deja fuera lo que el back no soporta.

## 10. Siguiente paso

Spec aprobada → `plan.md` (archivos, mapa CA → pruebas, orden) → apruebas → `tasks.md` → código, pruebas y `docs/commits/002.md`; me detengo para tu revisión.
