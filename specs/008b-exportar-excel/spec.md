# Spec 008b — Exportar métricas y encuestas a Excel

**Repo:** `mocca-go-front` · **Fecha:** 2026-11-12 · **Estado:** v2, aprobada el 2026-11-12 (DP-01..DP-09 como se plantean) · decisiones en `docs/decisions.md` D-133 en adelante
**Contrato consumido:** `GET /metrics` y `GET /surveys` (ya consumidos en 008; sin rutas nuevas ni cambios en el back) · **Siguiente paso:** `plan.md` → `tasks.md`

---

## 1. Objetivo
Que el **administrador** descargue a un archivo **Excel (.xlsx)** lo que ve en **Métricas** y en **Encuestas**, para analizarlo aparte (mercado, tendencias, tablas dinámicas). Sin pasar por Postman ni copiar a mano.

## 2. Decisiones ya tomadas
| ID | Decisión | Origen |
|---|---|---|
| D-012 | Solo el admin entra a `/admin`. | Spec 001 |
| D-018 | Dinero en pesos enteros (COP), fechas de Colombia. | Spec 002 |
| D-129..D-131 | Métricas y encuestas con sus filtros en la URL. | Spec 008 |

## 3. Alcance
**Entra**
- Botón **«Descargar Excel»** en `/admin/metricas`: exporta el **periodo y la zona que se están viendo**.
- Botón **«Descargar Excel»** en `/admin/encuestas`: exporta **todas las respuestas que cumplen los filtros** (no solo la página visible).
- Archivo `.xlsx` generado **en el navegador** con los datos ya consultados al back (sin endpoint nuevo).

**No entra**
- Exportar la lista de pedidos u otros listados (se puede pedir después).
- PDF, CSV, envío por correo o reportes programados.
- Gráficas dentro del Excel (quedan los datos, que es lo que sirve para analizar).

## 4. Hallazgos
1. **Sin cambios en el back:** `GET /metrics` ya devuelve todo (incluido `daily`, `byCategory`, `byZone`) y `GET /surveys` admite hasta 100 por página.
2. **Las encuestas no tienen «exportar todo» en el back:** hay que pedir página por página (100 a la vez) hasta completar; el límite de la pasarela y el back es de 100 por petición.
3. **Excel necesita números reales, no texto:** dinero como número (con formato de pesos), porcentajes como fracción con formato %, fechas como fecha; así sirven para fórmulas y tablas dinámicas.
4. **Hojas de cálculo y datos del cliente:** los comentarios de las encuestas son texto libre del cliente; una celda que empiece con `=`, `+`, `-` o `@` podría ejecutarse como fórmula al abrirla en Excel («inyección de fórmulas»). Se neutraliza antes de escribir.
5. **Librería:** generar `.xlsx` necesita una librería. Se carga solo al pulsar el botón (`import()` dinámico), así no pesa en el resto de la app.

## 5. Decisiones pendientes (DP)
| DP | Tema | Propuesta |
|---|---|---|
| DP-01 | Formato | `.xlsx` (Excel). |
| DP-02 | Librería | **ExcelJS** (mantenida, con estilos y formatos de número, sin las vulnerabilidades conocidas de la versión pública de SheetJS). Carga diferida al pulsar el botón. Se verifica `npm audit`. *En ejecución:* ExcelJS 4.4.0 arrastra `uuid` 8.3.2 (aviso moderado); se fija `uuid` 11.1.1 con `overrides` y el audit queda en 0. |
| DP-03 | Hojas del archivo de métricas | **«Resumen»** (periodo, zona, fecha de generación y cifras clave: pedidos, ingresos, ticket promedio, costo variable, margen, % a tiempo, tiempos, satisfacción, recompra, resultados) · **«Ventas por día»** (fecha, pedidos, ingresos) · **«Margen por categoría»** · **«Entregas por zona»** (con tiempos por etapa) · **«Satisfacción»** (distribución 1–5). |
| DP-04 | Hoja de encuestas | Una hoja **«Encuestas»** con: fecha y hora, pedido, cliente, zona, calificación, comentario; más una hoja **«Filtros»** con lo aplicado (calificación, desde, hasta, total, fecha de generación). |
| DP-05 | Qué se exporta de encuestas | **Todas** las que cumplen los filtros, pidiendo de 100 en 100, con barra de avance («Preparando… 300 de 1.250») y botón **Cancelar**. Tope de **10.000** filas; si hay más, se avisa y se exportan las más recientes 10.000 (el aviso también queda en la hoja «Filtros»). |
| DP-06 | Valores en el Excel | Números reales: dinero como número con formato `$#,##0` (COP, sin decimales), tasas como fracción con formato `0.0%`, minutos con un decimal, fechas como fecha/hora de Colombia. **Sin datos** = celda vacía (no 0). Encabezados en negrita, fila fija, ancho de columnas razonable y filtros activados. |
| DP-07 | Nombre del archivo | `mocca-go-metricas_2026-10-14_a_2026-11-12.xlsx` (con `_zona-1` si hay zona) y `mocca-go-encuestas_AAAA-MM-DD.xlsx`. Solo letras, números y guiones. |
| DP-08 | Seguridad de datos | Celdas de texto que empiecen con `=`, `+`, `-`, `@`, tabulador o salto de línea se escriben con una comilla simple delante, para que Excel no las ejecute como fórmula. Se prueba con un comentario malicioso. |
| DP-09 | Estados y errores | El botón se desactiva mientras prepara y dice «Preparando…»; en métricas solo está activo si hay datos cargados (y sin error de periodo); si falla una página de encuestas se detiene, se explica con el texto del back y no se descarga un archivo incompleto; la descarga se anuncia con un aviso `role="status"` («Descargado: nombre.xlsx»). |

## 6. Comportamiento
- **Métricas:** al pulsar, se usan los datos **ya cargados** del periodo y zona visibles (sin otra consulta), se genera el archivo y se descarga. Si el periodo está desactualizado, se recomienda «Actualizar» antes (el archivo lleva la hora de la consulta).
- **Encuestas:** al pulsar, se consultan las páginas necesarias con los filtros de la URL, con avance y cancelación; al terminar se descarga.
- **Roles:** solo admin; el archivo se arma en el navegador con datos que el back ya autorizó.
- **Sin dependencias del servidor:** no se sube nada a ningún sitio; el archivo se genera y se guarda localmente.

## 7. Criterios de aceptación
| CA | Descripción |
|---|---|
| CA-01 | `/admin/metricas` tiene «Descargar Excel» activo solo con datos cargados; descarga un `.xlsx` con las hojas de DP-03 para el periodo y zona visibles. |
| CA-02 | Los valores son numéricos reales con formato (pesos, %, minutos, fechas); «Sin datos» es celda vacía; las hojas coinciden con lo que muestra la pantalla. |
| CA-03 | `/admin/encuestas` descarga **todas** las respuestas de los filtros (varias páginas de 100), con avance y «Cancelar»; el total del archivo coincide con el total del back. |
| CA-04 | Tope de 10.000 filas con aviso (en pantalla y en la hoja «Filtros»). |
| CA-05 | Un comentario que empieza con `=`, `+`, `-` o `@` queda como texto y no como fórmula. |
| CA-06 | Error en una página: mensaje del back, sin archivo incompleto; cancelar no descarga nada. |
| CA-07 | El archivo se genera con la librería cargada solo al pulsar (no aumenta el trozo de las demás pantallas); nombre según DP-07. |
| CA-08 | Accesibilidad: botón ≥ 48 px, estado «Preparando…» y resultado anunciados (`role="status"`), cancelar con teclado. |
| CA-09 | `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `audit` y `e2e` en verde. |
| CA-10 | Pruebas: unitarias (armado de hojas, formatos, neutralización de fórmulas, nombre del archivo, tope y paginación), de componente (botón, avance, cancelar, error) y E2E (descarga real, se abre y se leen hojas y valores, métricas y encuestas, 360 px). |

## 8. Riesgos y pendientes
- **P-16 (tuyo):** abrir el archivo descargado en tu Excel y confirmar que formatos, filtros y números se ven bien (en el E2E se lee el archivo con código, pero no con tu Excel).
- Exportar miles de encuestas hace varias peticiones seguidas al back: se pide de una en una (sin paralelismo) para no saturarlo.

## 9. Fuera de alcance, para después
Exportar pedidos y rondas, programar reportes, gráficas dentro del Excel.
