# Spec 004c — Producción del día (inventario como abasto de cocina)

**Repo:** `mocca-go-front` · **Fecha:** 2026-11-10 · **Estado:** aprobada el 2026-11-10 (DP-01 a DP-09 pasan a D-076 a D-083; la opción A es D-075)
**Contrato consumido:** `docs/openapi.json` (`GET /products`, `POST /movements`, `GET /movements`; sin cambios) · **Siguiente paso tras aprobar:** `plan.md` → `tasks.md`

---

## 1. Objetivo

Los productos (pandebono, cafés…) **se hacen en la cocina del negocio, no se compran**. El inventario deja de ser «lo que compramos» y pasa a ser **«el abasto que tenemos para producir hoy»**: con lo que hay en cocina alcanza para 50 cafés, 30 pandebonos, etc. El operador abre el día fijando esas cantidades, la venta las va descontando sola, y lo que se pierde se registra como merma. **No hay cambios en el back**: el saldo de cada producto significa «cuántos podemos entregar hoy», y se sigue moviendo con entradas y salidas.

## 2. Decisiones ya tomadas

| ID | Decisión | Origen |
|---|---|---|
| D-065 a D-074 | Pantallas «Productos» e «Inventario», movimiento sin reintento automático (el movimiento no es idempotente), estado en palabras con ícono, combos sin movimientos, sin costos. | Spec 004b |
| (esta conversación) | Opción A: el inventario es el abasto de producción del día, sin ingredientes ni recetas. La opción de ingredientes y recetas (que exige cambios en el back) queda anotada como evolución posible. | Usuario, 2026-11-10 |

## 3. Alcance

**Entra**
- **Vocabulario nuevo** en las pantallas del 004b: lo que antes era «Saldo» pasa a «Disponibles»; «Entrada» pasa a «Producción» y «Salida» a «Merma o salida»; motivos sugeridos.
- **«Preparar el día»**: tercera sección de «Inventario» donde el operador (o el admin) fija de una vez cuántas unidades de cada producto hay para hoy.
- Resultado por fila y manejo de errores parciales, sin reintentos automáticos.
- Mock y pruebas (unitarias, de componente y E2E).

**No entra**
- Ingredientes, recetas, descuento por ingrediente (requiere el back; ver §9).
- Alertas de «poco abasto» (el back no tiene umbral).
- Cierre de día automático, programación o reinicio a medianoche.
- Combos: su saldo se calcula con los componentes y no se edita.

## 4. Contrato consumido

Sin operaciones nuevas. «Preparar el día» usa `POST /movements` (`IN` para subir, `OUT` para bajar, motivo obligatorio de 1 a 300 caracteres), una petición por producto, y `GET /products` para el saldo actual. El back solo suma o resta: **no existe «fijar saldo en N»**, así que el front calcula la diferencia contra el saldo vigente.

## 5. Decisiones de diseño propuestas (requieren tu visto bueno)

| ID | Propuesta | Alternativa |
|---|---|---|
| DP-01 | **Vocabulario:** «Saldo» → **«Disponibles»**; tipo `IN` → **«Producción»** (ícono de entrada) y `OUT` → **«Merma o salida»**; en el historial y en el formulario. El saldo conserva el sentido de «cuántos podemos entregar» aunque quede de un día para otro. | Mantener «Entrada / Salida» y solo cambiar los motivos. |
| DP-02 | **Motivos sugeridos** como botones sobre el campo de motivo (siguen siendo texto libre, obligatorio, 1–300): en producción «Producción del día», «Reposición»; en salida «Merma», «Consumo interno», «Ajuste por conteo». | Solo campo libre. |
| DP-03 | **«Preparar el día»:** lista de productos simples activos, con «Disponibles ahora» y un campo **«Para hoy»** (cantidad entera ≥ 0, vacío = no cambiar). Debajo de cada fila con valor se ve la diferencia («+20» o «−5»). Un solo motivo para todo el lote, con «Preparar el día» por defecto y editable. | Un formulario por producto (lo que ya existe). |
| DP-04 | **Aplicar en lote:** botón «Aplicar cambios» que pide un resumen («12 productos: 9 suben, 3 bajan») y envía **un movimiento por producto, de uno en uno** (no en paralelo). Antes de enviar se vuelve a consultar el catálogo para calcular la diferencia con el saldo más reciente. | Enviar todo en paralelo. |
| DP-05 | **Errores parciales sin reintento automático:** cada fila muestra su resultado (✓ aplicado, ✗ motivo del back, «No sabemos si se registró: revisa el historial» ante un corte de red). Si una fila falla, **el lote continúa con las demás** y al final se resume. Solo las filas con fallo definitivo (4xx) se pueden volver a aplicar; las ambiguas no, hasta revisar el historial. | Detener el lote en el primer error. |
| DP-06 | **Sin duplicar:** mientras el lote corre el botón queda deshabilitado (marca síncrona); al terminar, los campos de las filas aplicadas se limpian para que «Aplicar» no vuelva a enviarlas. | — |
| DP-07 | **Acceso:** «Preparar el día» está en `/operador/inventario` y `/admin/inventario` (misma pantalla), como tercera sección junto a «Saldos» e «Historial». | Pantalla aparte en la navegación. |
| DP-08 | **Límites visibles:** cantidad entera de 0 a 100 000 en «Para hoy» (el back rechaza pasarse del máximo con 409, que se explica por fila). Los productos inactivos y los combos no aparecen. | Sin tope en el front. |
| DP-09 | **Diseño:** tarjetas en 360 px y filas en pantallas anchas; campos numéricos con teclado numérico; botones ≥ 48 px; foco al primer campo y al resumen; solo tokens de color. | — |

## 6. Rutas y comportamiento

- **Preparar el día:** buscar y filtrar por categoría como en «Saldos»; escribir «Para hoy» en las filas que cambian; revisar el resumen; «Aplicar cambios». Mientras corre, una línea de progreso («Aplicando 4 de 12…»). Al terminar: resumen y cada fila con su resultado.
- **Saldos / Historial:** igual que en el 004b con el vocabulario nuevo.

## 7. Criterios de aceptación

| CA | Criterio |
|---|---|
| CA-01 | Las pantallas del 004b usan «Disponibles», «Producción» y «Merma o salida», con los motivos sugeridos; los motivos siguen siendo editables y obligatorios. |
| CA-02 | «Preparar el día» lista los productos simples activos con «Disponibles ahora» y «Para hoy»; los campos vacíos no cambian nada; solo se aceptan enteros de 0 a 100 000. |
| CA-03 | La diferencia por fila es correcta (sube → `IN`, baja → `OUT`, igual → no se envía) y el resumen cuenta cuántos suben y cuántos bajan. |
| CA-04 | «Aplicar» vuelve a consultar el catálogo, calcula con el saldo más reciente y envía **un movimiento por producto, en serie**, con el motivo del lote. |
| CA-05 | Si una fila falla, las demás se aplican igual; cada fila muestra su resultado; un corte de red marca la fila como ambigua y no se reintenta sola. |
| CA-06 | Un doble clic en «Aplicar» no envía nada repetido; tras aplicar, las filas aplicadas se limpian. |
| CA-07 | El historial muestra los movimientos del lote con el motivo elegido y el responsable. |
| CA-08 | Accesibilidad: campos con etiqueta que incluye el producto («Para hoy: Capuchino»), resumen y resultados con `aria-live`, foco gestionado, estados con texto + ícono, botones ≥ 48 px, sin desborde en 360 px. |
| CA-09 | Solo tokens de color; `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `audit` y `e2e` en verde. |
| CA-10 | Pruebas: unitarias (diferencias, validación, resumen), de componente (lote, errores parciales, doble clic) y E2E contra el mock (preparar el día, error parcial, historial, 360 px). |

## 8. Verificación contra el back real

1. En «Preparar el día» fija «Capuchino» en 50 y «Pandebono» en 30; aplica: los saldos quedan en esos valores y el historial muestra las dos entradas/salidas con el motivo del lote.
2. Vuelve a fijar «Capuchino» en 40: aparece una salida de 10.
3. Haz un pedido de capuchino como cliente y repite el paso 1 con otro valor: la diferencia se calcula con el saldo ya descontado.
4. Fija un producto en un valor imposible (por encima del máximo): la fila muestra el error del back y las demás se aplican.

## 9. Riesgos y pendientes

- **Fijar saldo no es atómico:** el back solo suma y resta. Si entra un pedido entre la consulta y el envío, el saldo final difiere en esa venta. Es una ventana de segundos; se mitiga con la consulta previa y el historial.
- **Lote parcial:** una falla de red a mitad deja filas aplicadas y otras no; por eso hay resultado por fila y no hay reintento automático.
- **Sin ingredientes:** si se acaba un ingrediente compartido (leche), el operador debe bajar varios productos a mano. La opción de ingredientes y recetas (módulo nuevo en el back) queda como evolución si lo necesitas.
- **Nada reinicia el día:** el saldo se arrastra hasta que alguien lo fije; «Preparar el día» es el momento para hacerlo.

## 10. Siguiente paso

Tu visto bueno a este spec (en especial DP-01, DP-03, DP-04 y DP-05) → `plan.md` → tu visto bueno → `tasks.md` → código y pruebas; me detengo para tu revisión.
