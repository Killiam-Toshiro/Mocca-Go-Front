# Notas sobre los mockups (borradores, 2026-11-09)

Referencia para las specs de los incrementos 2 a 8. **No es una spec ni un compromiso:** son borradores del usuario y pueden cambiar. Los mockups originales están en Figma del usuario.

## Qué muestran

- **Cliente (móvil):** menú con pestañas Cafés/Snacks → detalle de producto → carrito → punto de entrega (zona + detalle) → pago → seguimiento del pedido → notificación.
- **Equipo:** panel de pedidos activos (escritorio); despacho en 4 pasos (corte de ronda, alistamiento/empaque, ruta por zona, entrega en punto).
- **Piloto/preventa:** catálogo de preventa y confirmación; tarjetas de elección de combo y resultados de la encuesta.

## Diferencias con el back actual (verificadas en `docs/openapi.json` y el handoff §6)

| En los mockups | En el back | Para decidir en la spec del incremento |
|---|---|---|
| Pago con Nequi, tarjeta de crédito o efectivo, con comisión del 3 % | Solo `tarjeta_demo`; sin comisión | Mostrar solo tarjeta de demostración, o pedir cambio al back |
| Producto con tamaño y extras | Sin opciones por producto; hay categorías y combos | Quitarlos, o pedir cambio al back |
| «Llega en ~12 min» desde la preparación | `etaAt` solo en `en_camino` | Mostrar ETA solo en camino |
| Notificaciones del sistema | Solo SSE dentro de la app | Avisos en la app |
| Botones Confirmado/Preparando/En camino/Entregado en un panel | Cocina: `start` y `ready`; despacho: ronda, `deliver`, `fail` | Un tablero por rol |
| Alistamiento/empaque con lista de verificación | Sin etapa ni endpoint | Solo interfaz, o quitarlo |
| Horario de entrega preferido | No existe | Quitarlo, o pedir cambio |
| Preventa, tarjetas de elección y resultados del piloto | No existen | Fuera del alcance actual; es otro producto |
| (no dibujado) | Historial de pedidos, cancelar, encuesta, perfil; admin: usuarios, catálogo, zonas, encuestas, métricas | Faltan mockups |

## Paletas con contraste calculado (WCAG)

Los borradores usan pizarra oscura (≈ `#1E293B`) sobre gris claro, verde para «Disponible» y rojo para borrar. No hay paleta definida; las pruebas de contraste de estas tres candidatas cumplen AA (≥ 4,5) en texto sobre fondo, secundario, blanco sobre primario y sobre acento.

| | Primario | Acento | Tinte | Secundario | Fondo |
|---|---|---|---|---|---|
| A Pizarra y caramelo | `#1E293B` | `#B45309` | `#FFF7E0` | `#586579` | `#F8F9FA` |
| B Espresso | `#3B2418` | `#9A5A1C` | `#F9EEDD` | `#6F5B4D` | `#FBF7F2` |
| C Pino campus | `#14342B` | `#1B6E4E` | `#E6F4EC` | `#5B6E66` | `#F6F8F6` |

Estados con contraste ≥ 4,5 sobre su tinte: recibido `#1D4ED8`/`#DBEAFE`, en preparación `#92400E`/`#FEF3C7`, listo `#6D28D9`/`#EDE9FE`, en camino `#0E7490`/`#CFFAFE`, entregado `#15803D`/`#DCFCE7`, cancelado `#B91C1C`/`#FEE2E2`.

**Decisión pendiente (usuario):** paleta definitiva. El incremento 1 usa los tokens neutros de shadcn; cambiar la paleta es sustituir las variables de `src/app/globals.css`.
