# Spec 008 — Admin: encuestas y panel de métricas

**Repo:** `mocca-go-front` · **Fecha:** 2026-11-12 · **Estado:** v2, aprobada el 2026-11-12 (DP-01..DP-10 como se plantean; DP-03 ajustada por ti: se usa una librería de gráficas) · decisiones en `docs/decisions.md` D-129 en adelante
**Contrato consumido:** `docs/openapi.json` (módulos `surveys` y `metrics`; `GET /surveys` y `GET /metrics` ya están en la tabla de la pasarela) y `docs/frontend-handoff.md` · **Siguiente paso:** `plan.md` → `tasks.md`

---

## 1. Objetivo
Que el **administrador** vea cómo va el negocio y qué opinan los clientes, sin pedir consultas al back: (a) **«Métricas»** (`/admin/metricas`), un panel con ventas, margen, tiempos de entrega, satisfacción, recompra y resultado de los pedidos en un periodo, filtrable por zona; (b) **«Encuestas»** (`/admin/encuestas`), la lista de respuestas de los clientes con filtros. Con esto se habilitan las dos últimas secciones «Próximamente» del admin.

## 2. Decisiones ya tomadas
| ID | Decisión | Origen |
|---|---|---|
| D-012 | Cada rol solo visita su prefijo; el admin solo `/admin`. | Spec 001 |
| D-014 / D-016 | Solo se habla con `/api/...`; las dos rutas de lectura ya están en la tabla. | Spec 001 |
| D-046 | Estados y mensajes con texto + ícono, nunca solo color. | Spec 003 |
| D-018 | Dinero en pesos enteros (COP) y fechas en America/Bogota. | Spec 002 |
| D-058 | Los 404/400 se explican con el texto del back. | Spec 004 |
| D-119 | Listas de personal: filtros en la URL y paginación como en 007a/007d. | Spec 007d |

## 3. Alcance
**Entra**
- `/admin/metricas`: selector de periodo (por defecto últimos 30 días, máximo 366) y de zona; tarjetas y gráficas descritas en §4.
- `/admin/encuestas`: lista paginada (más reciente primero), filtros por calificación y rango de fechas, y resumen de lo que se ve.
- Habilitar las dos entradas en la navegación (0 secciones «Próximamente»).
- Mock con estado coherente con las reglas del back; pruebas unitarias, de componente y E2E.

**No entra**
- Exportar a Excel/CSV, comparar periodos, alertas, tiempo real (las métricas se consultan, no se transmiten).
- Responder o moderar comentarios (el back no lo permite: una respuesta por pedido, no se edita).
- La encuesta del cliente (ya hecha en 006).

## 4. Contrato consumido
| Operación | Parámetros / respuesta | Errores |
|---|---|---|
| `GET /metrics` | Solo admin. `from`, `to` (`YYYY-MM-DD`, hora de Colombia; defecto 29 días antes de `to` → hoy), `zoneId` (UUID). Devuelve `period{from,to,days,zoneId}`, `sales{orders,revenue,averageTicket,daily[{date,orders,revenue}] con ceros}`, `margin{revenue,variableCost,margin,variableCostRate\|null,byCategory[…]}`, `delivery{delivered,onTimeRate\|null,onTimeThresholdMinutes(15),totalMinutes{average,median,p90}\|null…,stageMinutes{kitchen,waiting,delivery},byZone[{zoneName,…}]}`, `satisfaction{responses,average\|null,responseRate\|null,distribution{1..5}}`, `retention{customers,repeatCustomers,repeatRate}`, `outcomes{entregado,no_entregado,cancelado,enCurso}`. | 400 (fechas/rango > 366) · 404 zona inexistente · 401/403 |
| `GET /surveys` | Solo admin. `page` (1–10000), `limit` (1–100, defecto 20), `rating` 1–5, `from`, `to`. `{page,limit,total,totalPages,data[{orderId,rating,comment\|null,createdAt,number,customer{name},zoneName}]}`. | 400 · 401/403 |

**Hallazgos**
1. **Sin cambios en el back:** todo lo necesario existe. Zonas para el filtro salen de `GET /delivery-zones/all` (ya consumido en 007c).
2. **Las métricas son de «pedidos creados en el periodo»**, no de entregados en el periodo; `outcomes` suma a los pedidos creados (incluye `enCurso`). Los textos de la pantalla lo dicen.
3. **Muchos valores pueden ser `null`** (sin datos suficientes: promedio, mediana, p90, tasas). Nunca se muestra 0 por un `null`: se muestra «Sin datos».
4. **Tasas vienen como proporción 0–1** (0.91 = 91 %); `variableCostRate` y `responseRate` igual.
5. **Margen por categoría** y **tiempos por zona** son listas pequeñas; el nombre de categoría viene como clave (`cafe`) y se traduce con el catálogo de etiquetas ya existente en 007b.
6. **El comentario de la encuesta es texto del cliente:** se pinta como texto (nunca HTML), con saltos de línea conservados y límite visual de 300 caracteres.
7. **Fechas:** el back toma días de Colombia; la pantalla envía el día elegido tal cual, sin convertir a UTC. `to` anterior a `from` o rango > 366 se valida en el cliente antes de enviar.

## 5. Decisiones pendientes (DP)
| DP | Tema | Propuesta |
|---|---|---|
| DP-01 | Estructura de métricas | Una pantalla con **filtro arriba** (periodo + zona) y secciones apiladas: Ventas, Margen, Entregas, Satisfacción, Recompra, Resultado de pedidos. Cada sección es una tarjeta con cifras grandes y, donde ayuda, una gráfica o barra. |
| DP-02 | Selector de periodo | Atajos «7 días», «30 días» (por defecto), «90 días», «Este mes» + «Personalizado» (dos fechas). El periodo y la zona viven en la **URL** (`?from=&to=&zoneId=`) para poder recargar o compartir. |
| DP-03 | Gráficas | **Librería Recharts** (ajuste tuyo: mejor diseño y lectura). Ventas por día en barras, calificaciones y resultados en barras horizontales, con colores solo por tokens (`--chart-*`), etiquetas y números en texto y **tabla alternativa** (no solo color). Se carga aparte (`React.lazy`) para no pesar en el resto de la app. |
| DP-04 | Cifras clave | Ventas: pedidos, ingresos (COP), ticket promedio. Margen: ingresos, costo variable, margen, % costo variable, y por categoría. Entregas: entregados, % a tiempo (≤ 15 min, valor del back), tiempo total (promedio, mediana, p90) y por etapa (cocina, espera, reparto), y por zona. Satisfacción: respuestas, promedio, % de respuesta, distribución. Recompra: clientes, recurrentes, %. Resultados: entregado, no entregado, cancelado, en curso. |
| DP-05 | Sin datos | Periodo sin pedidos: cada tarjeta muestra «Sin datos en este periodo» y las gráficas se reemplazan por ese texto; no se muestran 0 % engañosos. |
| DP-06 | Carga y errores | Esqueleto por sección; error con «Reintentar» y texto del back (400 de rango, 404 de zona → «Entendido» y se limpia el filtro de zona). Sin reintento automático de más de una vez en 5xx (igual que las demás consultas). Sin refresco automático: botón «Actualizar» y fecha/hora de la última consulta. |
| DP-07 | Encuestas: lista | Tarjetas/filas (pedido #número, cliente, zona, estrellas en texto «4 de 5» + ícono, comentario, fecha) paginadas de 20; filtros calificación (1–5/todas) y fechas **en la URL**; botón «Quitar filtros». |
| DP-08 | Resumen de encuestas | Encima de la lista: total de respuestas que cumplen el filtro (del `total` del back). **No se calcula promedio en el cliente** (la página es parcial): el promedio y la distribución viven en Métricas, con enlace «Ver métricas del mismo periodo». |
| DP-09 | Enlace a pedido | El número de pedido enlaza a `/admin/pedidos/[id]` (ya existe en 007d). |
| DP-10 | Mock | Almacén con estado y datos sembrados determinísticos (pedidos de varios días, estados, zonas, encuestas con y sin comentario) que calcula `metrics` y `surveys` con las mismas reglas y redondeos que el back (ceros diarios, `null` sin datos, filtro por zona, 400 y 404 con los textos del back). |

## 6. Comportamiento
- **Carga:** esqueleto; error con «Reintentar»; vacío con texto claro.
- **Filtros:** cambiar periodo o zona actualiza la URL y vuelve a consultar; mientras carga se conserva lo anterior atenuado (sin parpadeo). Volver atrás en el navegador restaura el filtro.
- **Roles:** solo admin; los demás por las guardas existentes.
- **Dinero:** `$ 1.044.000` (COP, sin decimales); minutos con un decimal; promedio de calificación con un decimal.

## 7. Criterios de aceptación
| CA | Descripción |
|---|---|
| CA-01 | `/admin/metricas` y `/admin/encuestas` solo las ve el admin; ambas quedan habilitadas y «Próximamente» baja a 0. |
| CA-02 | Métricas muestra las seis secciones con las cifras del back, dinero en COP y tasas en %; `null` → «Sin datos», nunca 0. |
| CA-03 | Periodo (atajos y personalizado) y zona filtran; viven en la URL; rango inválido (> 366 días o `to` < `from`) se explica antes de enviar. |
| CA-04 | Gráficas con Recharts cargado aparte, con tokens de color, texto y tabla alternativa; no dependen solo del color. |
| CA-05 | Periodo sin pedidos muestra «Sin datos en este periodo» sin porcentajes engañosos. |
| CA-06 | Errores: 400 y 404 con el texto del back; error de red con «Reintentar»; botón «Actualizar» con hora de la última consulta. |
| CA-07 | Encuestas: lista paginada, más reciente primero, con filtros de calificación y fechas en la URL; «Quitar filtros»; vacío con y sin filtros. |
| CA-08 | El comentario se muestra como texto plano seguro (sin HTML) y respeta saltos de línea; sin comentario se omite. |
| CA-09 | El número de pedido enlaza al detalle del admin; enlace «Ver métricas del mismo periodo». |
| CA-10 | Accesibilidad: etiquetas visibles, `role="status"/"alert"`, foco coherente al filtrar, tablas con encabezados, contraste AA, estrellas con texto. |
| CA-11 | Diseño: 360 px sin desborde (gráficas y tablas con scroll interno si hace falta), controles ≥ 48 px, escritorio centrado, solo tokens. |
| CA-12 | `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle` (Recharts en un trozo aparte que solo baja el panel), `audit` y `e2e` en verde. |
| CA-13 | Pruebas: mock con reglas del back; unitarias (formato de dinero/%/minutos, validación de periodo, mapeo de parámetros); de componente (cada sección, `null`, sin datos, filtros, paginación); E2E (ver métricas, cambiar periodo y zona, ver encuestas, filtrar, paginar, 360 px). |

## 8. Riesgos y pendientes
- **P-15:** el cálculo real de métricas solo se valida contra el back real; los números del mock se comprueban contra los ejemplos del OpenAPI, pero queda **tu prueba manual** con datos reales (¿cuadran ventas y margen con lo que esperas?).
- Con muchos pedidos el back puede tardar en `GET /metrics`: se muestra el esqueleto y no se reintenta de forma agresiva.

## 9. Fuera de alcance, para después
Exportar, comparar periodos, alertas por baja calificación.
