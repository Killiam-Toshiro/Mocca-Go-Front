# Spec 007c — Admin: zonas y puntos de entrega

**Repo:** `mocca-go-front` · **Fecha:** 2026-11-12 · **Estado:** v3, aprobada el 2026-11-12 (DP-01 a DP-10 como se plantean; DP-06 y DP-10 ajustados al incremento 021 del back) · decisiones en `docs/decisions.md` D-124 en adelante
**Contrato consumido:** `docs/openapi.json` (actualizado con el incremento 021 del back; módulos `delivery-zones` y `delivery-points`, sin rutas nuevas; ya están en la tabla de la pasarela) y `docs/frontend-handoff.md` §3, §5 · **Siguiente paso:** `plan.md` → `tasks.md`

---

## 1. Objetivo

Que el **administrador** gestione desde la app dónde se entrega: crear, renombrar, activar/desactivar y eliminar **zonas**, y crear, editar, **mover de zona**, activar/desactivar y eliminar **puntos de entrega**. Hoy solo existen los del seed; con esto el admin deja de depender de Postman. Lo que el admin cambie es lo que el cliente ve al pagar.

## 2. Decisiones ya tomadas

| ID | Decisión | Origen |
|---|---|---|
| D-012 | Cada rol solo visita su prefijo; el admin solo `/admin`. | Spec 001 |
| D-014 / D-016 | El navegador solo habla con `/api/...`; las 7 operaciones de zonas y puntos ya están en la tabla de rutas. | Spec 001 |
| D-046 | Estados con texto + ícono, nunca solo color. | Spec 003 |
| D-058 | 409/404 se explican en un aviso («Entendido») con el texto del back y se refresca el estado. | Spec 004 |
| D-111 | Crear, editar y eliminar no se reintentan solos; tras un corte de red se consulta y se confirma. | Spec 007a |
| D-117 | Activar/desactivar y eliminar piden confirmación en línea. | Spec 007b |
| D-118 | Recuperación tras corte de red consultando el estado real. | Spec 007b |

## 3. Alcance

**Entra**
- Pantalla **«Zonas y puntos»** (`/admin/zonas`), habilitada en la navegación del admin (hoy «Próximamente»).
- Lista de **todas** las zonas con **todos** sus puntos (activos e inactivos, zonas vacías incluidas), de `GET /delivery-zones/all`.
- **Zonas:** crear, renombrar, activar/desactivar, eliminar (solo sin puntos).
- **Puntos:** crear, editar (nombre, indicación, pisos), **mover** a otra zona, activar/desactivar, eliminar.
- Mock con estado y las reglas y textos del back; pruebas unitarias, de componente y E2E.

**No entra**
- Reordenar manualmente (el back ordena por nombre).
- Mapas o coordenadas (el back no las tiene).
- Pedidos y rondas (007d) ni métricas por zona (008).

## 4. Contrato consumido

| Operación | Cuerpo / respuesta relevante | Errores a manejar |
|---|---|---|
| `GET /delivery-zones/all` | Solo admin. `{ data: Zone[] }`, zonas por nombre y puntos por nombre; incluye inactivos y zonas sin puntos. `Zone`: `{ id, name, active, createdAt, updatedAt, points: Point[] }`. `Point`: `{ id, name, hint\|null, floors\|null, zoneId, active, createdAt, updatedAt }`. | 401, 403 |
| `POST /delivery-zones` | `{ name }` (1–60, con algún carácter visible). 201 → `Zone` (activa, sin puntos). | 400 · 409 `Ya existe una zona con ese nombre.` |
| `PATCH /delivery-zones/{id}` | `{ name?, active? }`, al menos uno. 200 → `Zone`. | 400 `Indica al menos un campo para editar.` · 404 `Zona no encontrada.` · 409 nombre repetido |
| `DELETE /delivery-zones/{id}` | 204. Solo si no tiene puntos ni rondas de despacho. | 404 · 409 `La zona tiene puntos; muévelos o elimínalos antes.` · 409 `La zona tiene rondas de despacho; desactívala en vez de eliminarla.` |
| `POST /delivery-points` | `{ zoneId, name, hint?, floors? }`: `name` 1–80, `hint` 1–200 (puede ir `null`/ausente), `floors` entero 1–30 o `null`/ausente («sin pisos»). 201 → `Point` (activo). | 400 · 404 `Zona no encontrada.` · 409 `Ya existe un punto con ese nombre.` |
| `PATCH /delivery-points/{id}` | `{ zoneId?, name?, hint? (null la borra), floors? (null = sin pisos), active? }`, al menos uno. `zoneId` mueve el punto. 200 → `Point`. | 400 · 404 `Punto no encontrado.` / `Zona no encontrada.` · 409 nombre repetido |
| `DELETE /delivery-points/{id}` | 204. Solo si ningún pedido lo usó. | 404 `Punto no encontrado.` · 409 `El punto tiene pedidos; desactívalo en vez de eliminarlo.` |

**Hallazgos al cruzar el handoff con el OpenAPI y el código del back**
1. **Sin cambios en el back:** todo lo necesario ya existe.
2. **El nombre del punto es único en todo el sistema** (restricción `POINT_NAME_KEY`), no solo dentro de su zona: «Edificio A» no puede repetirse en otra zona. El formulario lo explica en el 409.
3. **Eliminar con historial ya responde 409** (incremento 021 del back, que cumple la RN-44 de su spec 015): un punto con pedidos → «El punto tiene pedidos; desactívalo en vez de eliminarlo.»; una zona con rondas de despacho, aunque no tenga puntos → «La zona tiene rondas de despacho; desactívala en vez de eliminarla.»; una zona con puntos conserva su 409. La alternativa es `PATCH` con `active: false`. (Antes de 021 esto era un 500: ya no hay que tratarlo como caso especial.)
4. **El caso común es eliminar con historial:** casi todo punto real tiene pedidos, así que la pantalla guía hacia «Desactivar» (DP-06).
5. **Desactivar no toca pedidos en curso:** los pedidos guardan `point_name` y `zone_name` como texto; renombrar o mover no cambia pedidos ya hechos.
6. **Lo que ve el cliente** (`GET /delivery-zones`, pública): solo zonas activas con al menos un punto activo. Desactivar la última zona o el último punto activo deja a los clientes **sin dónde pedir** (DP-07).
7. **Mover un punto** exige que la zona destino exista; no importa si está inactiva.
8. **Pisos:** `null` es válido («sin pisos», p. ej. «Zona Samán»); el cliente solo pide piso cuando hay pisos.
9. **Qué devuelve cada escritura** (revisado contra el OpenAPI): crear y editar una **zona** devuelven la zona **con todos sus puntos**; crear, editar o mover un **punto** devuelven **solo el punto** (con `zoneId`, sin nombre de zona). Por eso, tras tocar un punto, la lista del admin se vuelve a consultar (`GET /delivery-zones/all`) en vez de armarla a mano; tras tocar una zona se puede usar la respuesta.
10. **La lista pública tiene límite de 20 peticiones por minuto por IP** (429): invalidar `['zones']` solo la marca como vieja y se vuelve a pedir cuando alguien abre el pago, no en cada cambio del admin. El 404 de crear/editar un punto puede ser del punto o de la zona destino: se muestra el texto del back.
11. **Ids y vacíos:** el `id` de ruta debe ser UUID v4 (si no, 400); `hint` no admite cadena vacía (mínimo 1), por eso vacío se envía como `null`.

## 5. Decisiones pendientes (DP)

| DP | Tema | Propuesta |
|---|---|---|
| DP-01 | Estructura de la pantalla | Una sola pantalla: una **tarjeta por zona** con sus puntos dentro (nombre, indicación, pisos, estado). Sin búsqueda ni paginación (el back devuelve todo y son pocas). Botón «Crear zona» arriba y «Agregar punto» en cada zona. |
| DP-02 | Dónde se edita | **Panel** (diálogo) como en 007b: «Crear/Editar zona» y «Crear/Editar punto»; el estado y eliminar viven en la tarjeta/fila. |
| DP-03 | Estado de zona | Activar/desactivar **con confirmación**. Al desactivar avisa: «Sus N puntos activos dejarán de verse para los clientes». |
| DP-04 | Estado de punto | Activar/desactivar **con confirmación** («Los clientes dejarán de verlo al pedir»). |
| DP-05 | Eliminar | Con confirmación en línea. **Zona:** el botón solo se ofrece sin puntos; con puntos se explica «Muévelos o elimínalos antes» (y el 409 del back se muestra igual). **Punto:** confirmación y, si falla con 409, aviso con opción de desactivar (DP-06). |
| DP-06 | Eliminar con historial (409 del back, incremento 021) | Ante el 409 por historial se muestra el **texto del back** y un botón «Desactivar» (`PATCH active:false`); sin reintento automático. Un 500 u otro error inesperado se muestra como error genérico, sin tratamiento especial. |
| DP-07 | Último punto/zona activo | Si la acción dejaría **cero zonas visibles para el cliente**, la confirmación lo dice explícitamente («Los clientes no podrán hacer pedidos hasta activar otro punto»). No se bloquea. |
| DP-08 | Pisos | Casilla «Este lugar tiene pisos»; si está marcada, número 1–30; si no, `null`. En edición se envía solo lo modificado; indicación vacía envía `null`. |
| DP-09 | Mover de zona | Selector «Zona» en el panel del punto (todas las zonas, marcando las inactivas); al guardar el punto aparece bajo su nueva zona. |
| DP-10 | Mock | Almacén con estado (zonas y puntos del seed actual) con las reglas y **los textos del back**, incluidos el nombre de punto único global y los **409 por historial** (punto con pedidos, zona con rondas), para probar DP-06. `GET /delivery-zones` pública sale del mismo almacén (activas con puntos activos). |

## 6. Comportamiento

- **Carga:** esqueleto; error con «Reintentar»; vacío «Aún no hay zonas. Crea la primera».
- **Tras cada cambio** se actualiza la lista del admin con la respuesta del back y se invalida también `['zones']` (la lista pública que usa el pago), para que el cliente vea el cambio sin recargar.
- **Errores:** 400 bajo el campo; 409 de nombre repetido junto al nombre; 404 → aviso «Entendido» y se refresca (D-058); red caída → mensaje y, en crear, se consulta la lista antes de ofrecer reintentar (D-118). Doble clic no duplica; sin reintento automático.
- **Roles:** solo admin; los demás por las guardas existentes.

## 7. Criterios de aceptación

| CA | Descripción |
|---|---|
| CA-01 | `/admin/zonas` solo la ve el admin (visitante → login; otros roles → su panel); «Zonas y puntos» queda habilitado y baja a 2 las secciones «Próximamente». |
| CA-02 | La pantalla lista todas las zonas con todos sus puntos, activos e inactivos, con estado en texto + ícono; zonas vacías visibles; esqueleto, error con «Reintentar» y vacío. |
| CA-03 | Crear zona y renombrarla; nombre repetido muestra el 409 del back bajo el campo. |
| CA-04 | Crear punto (nombre, indicación, con/sin pisos) y editarlo enviando solo lo modificado; indicación vacía envía `null`; «sin pisos» envía `null`. |
| CA-05 | Mover un punto a otra zona; aparece bajo la nueva. Nombre repetido (global) explicado. |
| CA-06 | Activar/desactivar zona y punto con confirmación; el aviso incluye cuántos puntos se ocultan y, si corresponde, que los clientes se quedan sin dónde pedir. |
| CA-07 | Eliminar zona solo sin puntos (con puntos se explica; 409 del back si aun así llega); eliminar punto con confirmación; ante el 409 por historial se muestra el texto del back y se ofrece desactivar. |
| CA-08 | Tras un cambio, el pago del cliente refleja lo nuevo (zona o punto creado, desactivado o movido) sin recargar. |
| CA-09 | Doble clic no duplica; sin reintento automático; tras un corte de red al crear se consulta antes de reintentar. |
| CA-10 | Accesibilidad: etiquetas visibles, `aria-describedby` en errores, estados con texto + ícono, `role="status"/"alert"`, foco al abrir/cerrar paneles, contraste AA. |
| CA-11 | Diseño: 360 px sin desborde; botones y filas ≥ 48 px; escritorio centrado; solo tokens. |
| CA-12 | `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `audit` y `e2e` en verde. |
| CA-13 | Pruebas: mock con las reglas del back; unitarias (esquemas, errores, hooks); de componente (lista, panel de zona y de punto, mover, confirmaciones, errores); E2E (crear zona y punto, el cliente los ve al pagar, mover, desactivar, eliminar, 409 por historial → desactivar, 360 px). |

## 8. Riesgos y pendientes

- **P-13 (back): resuelto** por el incremento 021 (409 con texto en vez de 500 al eliminar con historial); `docs/openapi.json` y los tipos generados ya están actualizados.
- **Prueba manual (tuya) contra el back real** al cerrar: crear/mover/desactivar y comprobar lo que ve el cliente al pagar; probar eliminar un punto con pedidos y una zona con rondas, y confirmar los dos 409 con sus textos (P-14).

## 9. Fuera de alcance, para después
Reordenar, importar zonas en lote, horarios por punto.
