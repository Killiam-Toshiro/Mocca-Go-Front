# Specs de Mocca Go Front

Cada incremento vive en `specs/NNN-<nombre>/` con tres archivos:

| Archivo | Qué contiene | Quién lo aprueba |
|---|---|---|
| `spec.md` | Qué y por qué: alcance, contrato, decisiones y criterios de aceptación (CA). | El usuario, antes de seguir |
| `plan.md` | Cómo: enfoque técnico, dependencias, archivos, mapa CA → pruebas, orden. | El usuario |
| `tasks.md` | Lista de tareas pequeñas y verificables. | — |

Al terminar se redacta `docs/commits/NNN.md` (overview con evidencia) y se **detiene el trabajo para revisión**.

Plantillas en `specs/_templates/`.

## Incrementos

| N.º | Nombre | Estado |
|---|---|---|
| 001 | Base, login/registro y rutas por rol | en revisión (T-01 a T-26 hechas) |
| 002 | Menú y carrito | implementado; falta tu prueba manual (T-14) y revisión |
| 003 | Pedido y pago (checkout, mis pedidos, detalle, cancelar) | implementado; falta tu prueba manual (T-11) y revisión |
| 003b | Seguimiento en vivo (SSE) | pendiente |
| 004 | Cocina | pendiente |
| 005 | Repartidor | pendiente |
| 006 | Cliente: encuesta y perfil | pendiente |
| 007 | Admin: catálogo, zonas, usuarios | pendiente |
| 008 | Admin: encuestas y panel de métricas | pendiente |
| 009 | Despliegue | pendiente |

Estados: pendiente → spec en borrador → spec aprobada → plan aprobado → en implementación → en revisión → cerrado.
