# Plan 004c — Producción del día

**Spec:** `specs/004c-produccion-del-dia/spec.md` (aprobada el 2026-11-10) · **Estado del plan:** borrador, pendiente de tu aprobación

Vocabulario: **lote** = el conjunto de cambios que se aplican con «Aplicar cambios». **Fila** = un producto dentro del lote. **Diferencia** = «Para hoy» menos «Disponibles ahora».

## 1. Enfoque técnico

| Bloque | Qué se construye | Archivos clave |
|---|---|---|
| A. Vocabulario | Un solo lugar para los textos: `STOCK_LABEL` («Disponibles»), `TYPE_LABEL` (`IN` «Producción», `OUT` «Merma o salida»), `REASON_SUGGESTIONS` por tipo. Se aplican en `product-row`, `stock-row`, `movement-form` (radios, botón «Registrar producción» / «Registrar salida», motivos sugeridos) y `movement-history` (insignia y nombre accesible). | `src/lib/inventory/labels.ts` y los componentes del 004b |
| B. Lógica pura del lote | `parseTarget(text)` (vacío = no cambiar; entero 0–100 000 sin signos, decimales ni ceros iniciales; mensajes en palabras); `buildPlan(products, targets)` → filas `{ id, name, current, target, delta, type }` solo con diferencia ≠ 0 (sube → `IN`, baja → `OUT`); `summarize(plan)` («12 productos: 9 suben, 3 bajan» con totales de unidades); `TARGET_MAX`. | `src/lib/inventory/day-plan.ts` (+ prueba) |
| C. Ejecución del lote | `usePrepareDay()`: `run(targets, reason)` → (1) con marca síncrona contra doble envío, (2) `queryClient.fetchQuery(['products'])` para traer los saldos más recientes (staleTime 0), (3) recalcula el lote con esos saldos, (4) envía **en serie** un `POST /api/movements` por fila con `requestJson` (sin `useMutation`, sin reintentos), (5) por fila guarda el resultado: `ok` (con el `stock` confirmado), `failed` (mensajes del back, 4xx), `ambiguous` (red o 5xx, D-080) u `omitted` (la diferencia ya era 0), (6) al final invalida `['products']` y `['movements']`. Expone `{ phase: 'idle' \| 'running' \| 'done', progress: { done, total }, results }`. Un fallo no detiene el resto. El estado vive en un `useReducer`; el motivo se valida con `parseMovement`/las mismas reglas (1–300, sin caracteres de control). | `src/lib/inventory/use-prepare-day.ts` (+ prueba) |
| D. Interfaz «Preparar el día» | `PrepareDay` (tercera sección de `InventoryView`): filtros de búsqueda/categoría (los del 004b), una `PrepareRow` por producto simple activo con `Disponibles ahora`, campo **«Para hoy: Capuchino»** (`inputMode="numeric"`, error asociado con `aria-describedby`), diferencia («+20», «−5») y resultado de la fila (✓ aplicado y nuevo saldo, ✗ mensaje, «No sabemos si se registró: revisa el historial» con «Ya lo revisé» que libera la fila). Campo de motivo con sugerencias. Flujo: «Revisar cambios» abre un resumen en línea («Aplicar N cambios» / «Volver»); al aplicar, línea de progreso `aria-live` («Aplicando 4 de 12…») y al terminar un resumen final («10 aplicados, 1 con error, 1 por revisar»). Filas aplicadas se limpian; las `failed` conservan lo escrito para volver a aplicarlas; las `ambiguous` quedan bloqueadas hasta «Ya lo revisé». | `src/components/inventory/prepare-day.tsx`, `prepare-row.tsx`, `reason-field.tsx` (compartido con `movement-form`) |
| E. Integración | `InventoryView` gana la sección «Preparar el día» (tres botones agrupados, `aria-pressed`); «Ver historial» también sirve desde el lote. Rutas y navegación sin cambios (ya existen `/operador/inventario` y `/admin/inventario`). | `inventory-view.tsx` |
| F. Mock y pruebas | El mock **no cambia**: ya valida `IN`/`OUT`, 409 por saldo o por máximo y guarda movimientos. Los fallos del lote se simulan en E2E con `page.route` sobre `POST /api/movements` mirando el cuerpo. Se actualizan las pruebas del 004b que citan «Saldo», «Entrada» o «Salida». | `*.test.tsx`, `e2e/inventory.spec.ts` |

### Decisiones técnicas del plan

- **Sin `useMutation` para el lote:** una mutación por fila escondería el orden y el estado intermedio; un ejecutor propio con un `useReducer` da progreso y resultados por fila, y garantiza el envío en serie.
- **Cero reintentos y cero paralelismo (D-079, D-080):** un `POST /movements` no es idempotente; cada fila se envía una sola vez y el siguiente comienza cuando el anterior termina.
- **Saldo más reciente:** al aplicar se vuelve a consultar el catálogo y la diferencia se calcula con ese dato, no con lo que se veía al escribir; si una fila ya cuadra (diferencia 0) se omite y se dice.
- **Ventana de carrera:** entre esa consulta y el envío puede entrar un pedido; el descuadre es de esa venta y queda en el historial. No se intenta compensar.
- **Combos e inactivos fuera de la lista;** los combos mantienen su saldo calculado.
- **El estado del lote no se pierde al cambiar de sección:** `targets` y resultados viven en `InventoryView`, no se reinician al ir a «Historial».
- **Sin setState dentro de efectos** (regla del proyecto); el foco al resumen y al primer campo se maneja con `ref` en manejadores.
- **Teclado y lector:** cada campo con etiqueta propia («Para hoy: Capuchino»), resumen y progreso con `aria-live`, resultados con texto + ícono.

## 2. Dependencias y versiones

Ninguna nueva.

## 3. Estructura de archivos

```
src/
  lib/inventory/   labels.ts, day-plan.ts, use-prepare-day.ts (+ pruebas)
  components/inventory/
                   prepare-day.tsx, prepare-row.tsx, reason-field.tsx (+ pruebas),
                   inventory-view.tsx, movement-form.tsx, movement-history.tsx,
                   product-row.tsx, stock-row.tsx (textos del 004b)
e2e/               inventory.spec.ts (casos nuevos de «Preparar el día»)
docs/              decisions.md (D-075…D-083), commits/004c.md
```

## 4. Mapa CA → pruebas

| CA | Prueba |
|---|---|
| CA-01 | `movement-form`, `inventory-view`, `products-view` y `movement-history` (textos nuevos y motivos sugeridos que rellenan el campo, siguen editables y obligatorios). |
| CA-02 | `day-plan.test.ts` (`parseTarget`: vacío, 0, 100 000, 100 001, decimales, signos, ceros iniciales, texto) y `prepare-day.test.tsx` (solo productos simples activos; combos e inactivos no aparecen). |
| CA-03 | `day-plan.test.ts` (sube → `IN`, baja → `OUT`, igual → fuera; totales del resumen) y `prepare-day.test.tsx` (diferencia visible por fila y resumen). |
| CA-04 | `use-prepare-day.test.tsx`: consulta previa, diferencia con el saldo más reciente, un `POST` por fila **en serie** (el segundo empieza cuando termina el primero), motivo del lote. |
| CA-05 | `use-prepare-day.test.tsx` y `prepare-day.test.tsx`: 409 en una fila → las demás se aplican; corte de red → fila ambigua, un solo `POST` para esa fila, bloqueada hasta «Ya lo revisé»; fallo 4xx → se puede volver a aplicar. E2E con `page.route`. |
| CA-06 | `prepare-day.test.tsx`: doble clic en «Aplicar» = un envío por fila; filas aplicadas se limpian. |
| CA-07 | E2E: tras aplicar, el historial muestra los movimientos con el motivo del lote y el responsable. |
| CA-08 | Pruebas de componente con roles y nombres, `aria-live` del progreso y del resumen, foco; E2E en 360 px sin desborde y botones ≥ 48 px. |
| CA-09 | `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `npm audit`, E2E completo. |
| CA-10 | El conjunto anterior (unitarias, de componente y E2E del mock). |

## 5. Orden de implementación (cada paso termina en verde: `tsc`, `eslint`, `prettier`, pruebas)

1. Vocabulario (`labels.ts`) aplicado a los componentes del 004b y actualización de sus pruebas.
2. Motivos sugeridos (`reason-field.tsx`) en el formulario de movimiento, con pruebas.
3. Lógica pura del lote (`day-plan.ts`) con pruebas.
4. Ejecutor (`use-prepare-day.ts`) con pruebas de serie, errores parciales y ambigüedad.
5. Interfaz «Preparar el día» y su integración en «Inventario»; pruebas de componente.
6. E2E nuevos (escritorio y 360 px) y revisión visual con capturas.
7. Verificación completa, `tasks.md` y `docs/commits/004c.md`; parar para tu revisión.

## 6. Riesgos técnicos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Un lote con muchos productos tarda (una petición por fila) | Línea de progreso y resultado por fila a medida que llegan; el menú real tiene ~25 productos, así que son segundos. |
| Cerrar la pestaña a mitad del lote | Lo ya enviado queda registrado en el historial; el resto no se envía; al volver se ve el saldo real. No hay reanudación automática. |
| Cambiar de sección o de pantalla durante el lote | El ejecutor vive en `InventoryView`, que sigue montado al cambiar de sección; al salir de la pantalla el lote se cancela sin enviar más filas (un `AbortSignal` ante desmontaje) y lo ya enviado queda en el historial. |
| Enviar dos veces la misma fila | Marca síncrona, un solo ejecutor por vista, filas aplicadas limpiadas y ambiguas bloqueadas. |
| E2E en paralelo (escritorio y 360 px) comparten el mock | Cada proyecto usa sus propios productos (como en 004b) y restaura saldos con `/__mock/inventory`. |
| El saldo cambia entre la consulta y el envío (un pedido) | Documentado; la diferencia se calcula lo más tarde posible y el historial lo deja visible. |
| Valores por encima del máximo del back | Tope de 100 000 en el campo; si el back responde 409, se explica en la fila. |

## 7. Fuera de plan

Ingredientes y recetas (requiere el back); alertas de poco abasto; cierre o reinicio automático del día; deshacer un lote; importar cantidades desde un archivo.
