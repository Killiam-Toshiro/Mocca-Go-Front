# Spec 007a — Admin: usuarios

**Repo:** `mocca-go-front` · **Fecha:** 2026-11-11 · **Estado:** v3 aprobado por el usuario (el back ya implementó el incremento 020; contraseña inicial genérica y pantalla «Mi cuenta» del personal decididas; las DP pasan a D-105 en adelante al registrarlas)
**Contrato consumido:** `docs/openapi.json` (actualizado con el incremento 020 del back; 53 operaciones, sin rutas nuevas) y `docs/frontend-handoff.md` §3, §5 · **Siguiente paso tras aprobar:** `plan.md` → `tasks.md`

---

## 1. Objetivo

Que el **administrador** gestione a las personas de la app: ver, **buscar** y filtrar usuarios (personal y clientes), **crear** operadores, repartidores y administradores, **editar** su usuario, nombre y teléfono, **restablecer su contraseña** (clave genérica), **cambiar su rol** y **eliminar** a quien no tenga historial. Con esto el admin completa el nombre y teléfono que un repartidor necesita para salir a repartir (el 409 «perfil incompleto» del 005) y puede ayudar a un cliente que perdió su contraseña (no existe «olvidé mi contraseña»).

## 2. Decisiones ya tomadas

| ID | Decisión | Origen |
|---|---|---|
| D-012 | Cada rol solo visita su prefijo; el admin solo `/admin`. | Spec 001 |
| D-014 / D-016 | El navegador solo habla con `/api/...`; la pasarela agrega el `Bearer`. Las 6 operaciones de `users` ya están en la tabla de rutas. | Spec 001 |
| D-046 | Estados con texto + ícono, nunca solo color. | Spec 003 |
| D-058 | 409/404 de una acción se explican en un aviso de pantalla («Entendido») y se refresca el estado. | Spec 004 |
| D-070 | Una petición no idempotente no se reintenta sola; tras un corte de red se revisa el estado antes de repetir. | Spec 004b |
| D-102/D-103 | Patrón de contraseñas: viven solo en el formulario, se vacían al terminar y tras un error de red. | Spec 006 |
| Usuario | Búsqueda y filtro en el servidor; **ningún cambio sobre tu propio usuario desde la pantalla**; paginador reutilizable `Pagination`. | Esta sesión |

## 3. Alcance

**Entra**
- Pantalla **«Usuarios»** (`/admin/usuarios`), habilitada en la navegación del admin (hoy «Próximamente»).
- Lista **paginada por el servidor** con búsqueda (debounce) y filtro por rol, sobre `Pagination`.
- **Crear**, **editar** (usuario, nombre, teléfono; en clientes solo nombre y teléfono), **restablecer contraseña** (personal y clientes), **cambiar rol** (solo personal) y **eliminar** personal.
- Pantalla **«Mi cuenta»** para admin, operador y repartidor (`/admin/cuenta`, `/operador/cuenta`, `/repartidor/cuenta`) con el cambio de contraseña propio (reutiliza el formulario del 006), para que el personal cambie la clave genérica que recibe.
- Mock de la API ampliado con las reglas y textos del back y pruebas (unitarias, de componente y E2E), incluida la del repartidor con perfil incompleto.

**No entra**
- **Editar el usuario o el correo de un cliente**: el back no lo permite (400).
- **Cambiar el rol o eliminar clientes**: el back rechaza el rol (409); eliminar clientes no se ofrece.
- **Desactivar** usuarios: el back no tiene esa operación; el personal con historial no se puede dar de baja (pendiente de negocio).
- Búsqueda sin tildes: el back distingue tildes («Lucía» no se encuentra con «Lucia»); el aviso se explica en la pantalla.
- Catálogo, zonas y pedidos del admin (007b, 007c, 007d).

## 4. Contrato consumido

| Operación | Cuerpo / respuesta relevante | Errores a manejar |
|---|---|---|
| `GET /users?page=&limit=&search=&role=` | Solo admin. `{ data: User[], page, limit, total, totalPages }`, `limit` 1–100 (20 por defecto), orden por `username` y luego `id`. **`search`**: hasta 100 caracteres, se recorta y se ignora si queda vacío; coincidencia parcial sin distinguir mayúsculas (pero **con tildes**) en usuario, nombre, teléfono y, en clientes, correo; con 3 o más dígitos también compara los dígitos del teléfono («300 123» encuentra `+573001234567`); `%`, `_` y `\` son literales. **`role`**: uno o varios roles separados por coma (`admin`, `operador`, `repartidor`, `cliente`). `total` y `totalPages` siguen el filtro. | 401, 403, 400 (`role` inválido, vacío o con coma sobrante; `search` de más de 100 caracteres o con NUL) |
| `POST /users` | `{ username, password, role, phone?, fullName? }`. `username`: `^[a-z0-9][a-z0-9._-]{2,63}$`; `password` 12–128; `role` ∈ `admin`, `operador`, `repartidor`; **`phone` y `fullName` obligatorios si el rol es `repartidor`** (`fullName` 2–80; celular a E.164). 201 → `User`. | 400 validación · 409 `El username ya existe.` |
| `PATCH /users/{id}` | `{ username?, password?, phone?, fullName? }`, al menos uno; sin `null`. **Personal:** `fullName` 2–80. **Cliente:** `fullName` 2–100 y `phone` se guardan en su ficha; `password` permitido (única vía de recuperación; revoca sus demás sesiones); `username` → 400 «El username de un cliente es interno y no se edita; el cliente entra con su correo.»; el correo no se edita. Una contraseña nueva revoca las demás sesiones del editado y reinicia su bloqueo. Solo escribe lo que cambia (repetir un valor no cambia `updatedAt`). | 400 `Indica al menos un campo para editar.` · 400 por campo (celular, nombre corto o largo; personal con 81–100: «El nombre del personal admite de 2 a 80 caracteres.») · 404 `Usuario no encontrado.` · 409 `El username ya existe.` |
| `PATCH /users/{id}/role` | `{ role }` (`admin`, `operador`, `repartidor`). **Revoca todas las sesiones del usuario**: su siguiente petición da 401 y vuelve al login; sus canales en vivo se cierran en máx. 25 s. Mismo rol → 200 sin cambios. | 404 · 409 `Un cliente no cambia de rol.` · 400 `Un repartidor necesita teléfono y nombre de contacto (phone y fullName).` · 409 `No se puede degradar al último administrador.` · 409 `No puedes cambiar tu propio rol.` |
| `DELETE /users/{id}` | 204. Sus sesiones caen de inmediato. Solo si **no tiene movimientos, pedidos, rondas ni encuestas**. | 409 `No se puede eliminar al último administrador.` · 409 `No puedes eliminar tu propio usuario.` · 409 `El usuario tiene historial asociado; no se puede eliminar.` · 404 |

`User`: `{ id, username, role, email|null, fullName|null, phone|null, createdAt, updatedAt }`. El personal devuelve `email: null`.

**Hallazgos tras el incremento 020 del back**
1. **No existe «desactivar»**: solo `DELETE`, rechazado con historial. Se dice en la pantalla y queda como pendiente de negocio.
2. La **búsqueda y el filtro ya son del servidor**: desaparece la descarga por tandas y el tope de 5000; el paginador usa `total` y `totalPages` del back.
3. El OpenAPI muestra `maxLength: 100` para `fullName` porque el tope depende del rol: **el front limita a 80 al editar personal y a 100 al editar un cliente**.
4. **Cambiar el rol cierra las sesiones** del usuario: el aviso ya no dice «aplica desde su siguiente petición» sino «Se cerrará su sesión y deberá iniciar sesión de nuevo».
5. **Cambiar a `repartidor` exige nombre y teléfono ya guardados** (400 si faltan): el front los pide en el mismo paso.
6. El back ya defiende (409) el cambio de **tu propio rol**, borrarte a ti y degradar o borrar al último admin; la pantalla además no ofrece esas acciones sobre tu fila.
7. El texto del 409 de borrado ahora es genérico («historial asociado»): el front **muestra siempre el mensaje del back** y no compara textos.

## 5. Decisiones de diseño propuestas (requieren tu visto bueno)

| ID | Propuesta | Alternativa |
|---|---|---|
| DP-01 | **Una sola pantalla** `/admin/usuarios`: tabla en escritorio (usuario, nombre, rol con texto + ícono, teléfono, alta, acciones) y tarjetas apiladas en celular; contenido centrado con ancho máximo. Los **clientes** muestran su correo y tienen acciones limitadas (editar nombre y teléfono, restablecer contraseña; sin rol ni eliminar). **Tu propia fila** lleva «Tú» y es de solo lectura (DP-05). | Una pantalla para personal y otra para clientes. |
| DP-02 | **Paginada, con búsqueda y filtro en el servidor**: 20 por página con `Pagination` («Mostrando 21–40 de 135»). Filtro por rol: «Personal» por defecto (`role=admin,operador,repartidor`), «Todos» (sin `role`), cada rol y «Clientes». Búsqueda por usuario, nombre, teléfono o correo con **debounce** (≈400 ms); al cambiar `search` o `role` se vuelve a la página 1; se conserva la lista anterior mientras llega la nueva (sin parpadeo) y se anuncia «N resultados». Aviso corto: «La búsqueda distingue tildes». | Descarga completa y filtro en el front (descartada: el back ya filtra). |
| DP-03 | **Crear usuario** en un panel: usuario, rol, nombre y teléfono (obligatorios si es repartidor) y contraseña **prellenada con la clave genérica `clave-generica`** (editable, con el ojo de siempre). Al crear: «Usuario creado con la clave genérica. Pídele que la cambie en Mi cuenta». (Decidido por el usuario.) | Generador aleatorio de 16 caracteres (descartado). |
| DP-04 | **Editar** en un panel por usuario: usuario (solo personal), nombre y teléfono con un solo «Guardar cambios» (solo envía lo modificado); límite de nombre 80 (personal) o 100 (cliente). Aparte, **«Restablecer contraseña»** (personal y cliente): campo **vacío** con el botón «Usar clave genérica» (nunca se aplica sola a una cuenta existente) y la advertencia «Cerrará las sesiones de este usuario y reiniciará su bloqueo». En un cliente el usuario y el correo se muestran sin poder editarse. | Todo en un formulario. |
| DP-05 | **Cambiar rol** como acción aparte (solo personal), con el aviso «Se cerrará su sesión y deberá iniciar sesión de nuevo». A repartidor sin nombre o teléfono, el front los pide en ese paso. **Ningún cambio sobre tu propio usuario desde la pantalla** (decidido): tu fila, solo lectura con «No puedes modificar tu propio usuario desde aquí». | Permitirlo con advertencia. |
| DP-06 | **Eliminar** (solo personal) con confirmación en línea («¿Eliminar a {usuario}? No se puede deshacer»). Los 409 y el 404 se muestran con el texto del back; en el de historial se añade «Ya tiene actividad; no se puede quitar». | Sin confirmación. |
| DP-07 | **Crear no se reintenta solo**: tras un corte de red se consulta la lista (búsqueda por el usuario) y, si ya existe, se da por creado; si no, se conserva lo escrito y se ofrece «Reintentar». Editar y cambiar rol (idempotentes): tras el corte se consulta y se confirma. Eliminar: si ya no está, se da por eliminado. Marca síncrona contra el doble clic. | Reintento automático. |
| DP-08 | **Errores:** 409 de usuario repetido bajo «Usuario»; 400 por campo según el texto del back; 404 y 409 de «último administrador», «tu propio rol/usuario» e «historial» en un aviso de pantalla («Entendido») con la lista refrescada. | — |
| DP-09 | **Contraseñas:** viven solo en el formulario, se vacían al terminar y tras un error de red; nunca van en la URL ni se guardan; `autocomplete="new-password"`. La clave genérica es una constante pública del front (no es un secreto): su único fin es que la cambie su dueño. | — |
| DP-10 | **Diseño:** móvil primero (360 px), botones y filas ≥ 48 px, sin desborde, solo tokens de color, contraste AA; escritorio centrado (64 rem). | — |
| DP-11 | **«Mi cuenta»** (admin, operador, repartidor): una pantalla con el nombre de usuario y rol y el formulario de cambio de contraseña del 006 (actual, nueva, repetir; no cierra la sesión actual, el back cierra las demás); entrada «Mi cuenta» en la navegación de esos tres roles. | Dentro de otro incremento. |

El back mantiene la contraseña del cliente como única vía de recuperación, así que «Restablecer contraseña» también cubre a clientes.

## 6. Rutas y comportamiento

| Ruta | Quién | Qué muestra |
|---|---|---|
| `/admin/usuarios` | Admin | Lista, búsqueda y filtro, y los paneles de crear/editar. |

**Reglas**
- Los parámetros de la lista (`search`, `role`, `page`) viven en el estado de la pantalla; la consulta se invalida tras cada acción.
- El rol «cliente» no se elige al crear ni al cambiar rol.
- El `username` se escribe en minúsculas ASCII; el front valida el formato del back y deja el mensaje del back como autoridad.
- Un repartidor creado o editado deja de dar «perfil incompleto» de inmediato (el back lee nombre y teléfono en cada ronda).
- Si el admin edita el nombre o teléfono de un cliente, el cliente lo ve en «Mi perfil» (`GET /customers/me`).
- **Fechas:** America/Bogota. **Seguridad:** solo admin; el back impone el permiso; todo texto se muestra como texto.

## 7. Criterios de aceptación

| ID | Criterio (verificable) |
|---|---|
| CA-01 | `/admin/usuarios` solo lo ve el admin (visitante → login; otros roles → su panel); «Usuarios» queda habilitado en la navegación del admin. |
| CA-02 | La lista sale de `GET /users?page&limit=20&search&role` y se pagina con `Pagination` usando `total`/`totalPages` del back: usuario, nombre, rol (texto + ícono), teléfono y alta; esqueleto al cargar; error con «Reintentar»; vacía con un mensaje; «Tú» en la propia fila (sin acciones). |
| CA-03 | El filtro por rol («Personal» por defecto = `admin,operador,repartidor`; «Todos» sin `role`) y la búsqueda con debounce se envían al servidor, vuelven a la página 1, mantienen la lista anterior mientras carga y anuncian «N resultados»; una búsqueda inválida o fallida se explica; se avisa que distingue tildes; se encuentra por teléfono con espacios o guiones. |
| CA-04 | Crear: valida usuario, contraseña (12–128; viene prellenada con `clave-generica`), rol y, para repartidor, nombre (2–80) y teléfono; un solo `POST /users` y aviso «Pídele que la cambie en Mi cuenta». |
| CA-05 | Editar envía **solo lo modificado**; se habilita solo si algo cambió; límite de nombre 80 (personal) / 100 (cliente); en un cliente no se ofrece usuario ni correo; un 400 de nombre o teléfono sale bajo su campo. |
| CA-06 | Restablecer contraseña (personal y cliente): campo vacío; «Usar clave genérica» lo rellena; valida 12–128, envía `{ password }`, advierte del cierre de sesiones, vacía el campo al terminar y tras un error de red. |
| CA-07 | Cambiar rol (solo personal): `PATCH /users/{id}/role` con el aviso de cierre de sesión; a repartidor sin nombre o teléfono los pide antes de enviar; tu propio usuario no ofrece ningún cambio; los clientes no ofrecen cambio de rol. |
| CA-08 | Eliminar (solo personal): confirmación en línea; `DELETE`; los 409 (último admin, tú mismo, historial) y el 404 se muestran con el texto del back en un aviso «Entendido» y la lista se refresca. |
| CA-09 | Errores por campo: 409 de usuario repetido bajo «Usuario»; 400 del back bajo su campo; el resto en el aviso del panel. |
| CA-10 | Crear, editar, cambiar rol, restablecer y eliminar: sin doble clic y sin reintento automático; tras un corte de red se consulta antes de ofrecer «Reintentar» (crear: si existe se da por creado; eliminar: si ya no está, por eliminado). |
| CA-11 | Con el mock: un repartidor con perfil incompleto no puede salir; el admin le completa nombre y teléfono y entonces sale. |
| CA-12 | Con el mock: el admin edita nombre y teléfono de un cliente y el cliente los ve en «Mi perfil»; el admin cambia el rol de un operador con sesión abierta y su siguiente petición lo lleva al login. |
| CA-13 | Accesibilidad: etiquetas visibles y asociadas, errores con `aria-describedby`, `aria-live` en avisos y resultados, foco al panel al abrirlo y de vuelta a la fila al cerrarlo, estados con texto + ícono, contraste AA. |
| CA-14 | Diseño: 360 px sin desborde; botones y filas ≥ 48 px; escritorio centrado; solo tokens de color. |
| CA-15 | `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `audit` y `e2e` en verde. |
| CA-16 | Pruebas: unitarias (validación, diferencias de edición, parámetros de la lista y debounce, mapeo de errores), de componente (lista, crear, editar, rol, eliminar, errores) y E2E contra el mock (crear, editar personal y cliente, restablecer, rol, eliminar, cada 409, corte de red, 360 px, el caso del repartidor). |
| CA-17 | «Mi cuenta» (admin, operador, repartidor): aparece en la navegación de los tres roles; cambia la contraseña con `PATCH /auth/password` (errores: actual incorrecta 403, igual a la actual 400, corte de red); el personal creado con la clave genérica puede entrar y cambiarla. |

## 8. Mock de la API (cambios)

`GET /users` real (almacén de usuarios con los 5 del seed más clientes) con `search` (parcial, sin mayúsculas, con tildes, dígitos del teléfono con 3+ dígitos, `%_\` literales) y `role` (lista por comas, 400 si es inválido o vacío o con coma sobrante), `total`/`totalPages` del filtro; `POST` y `PATCH /users/{id}` (cliente: nombre 2–100 y teléfono sí, usuario → 400 con el texto del back, contraseña sí; personal: nombre 2–80); `PATCH /users/{id}/role` (401 posterior del token editado, 409 de cliente, de último admin y de tu propio rol, 400 de repartidor incompleto); `DELETE` con los tres 409 (texto «historial asociado»).

## 9. Verificación contra el back real

Con el back local y el seed:
1. `?role=admin,operador,repartidor` no lista clientes; registrar un cliente y buscarlo por correo, nombre y dígitos del teléfono.
2. Editar nombre y teléfono del cliente desde el panel y verlos en su «Mi perfil».
3. Crear un operador con contraseña generada; entrar con él en otra ventana; cambiarle el rol desde el admin y comprobar que su siguiente consulta da 401.
4. Crear un repartidor sin teléfono (el front lo impide) y con teléfono (sale a repartir).
5. Restablecer la contraseña de un operador con su sesión abierta: 401 en su siguiente consulta.
6. Intentar cambiar tu propio rol o borrarte (la pantalla no lo ofrece; el back da 409), degradar al único admin (409) y borrar a alguien con pedidos o rondas (409 «historial asociado»).

## 10. Riesgos y pendientes

- **Sin «desactivar»:** el personal con historial no se puede dar de baja (incremento posterior del back).
- **Clave genérica conocida:** mientras el usuario no la cambie, cualquiera que la conozca puede entrar a esa cuenta; el back no fuerza el cambio al primer ingreso (queda como mejora). Por eso «Restablecer» no la aplica sola y «Mi cuenta» entra en este incremento.
- **Búsqueda con tildes:** «Lucía» no se encuentra con «Lucia»; se avisa en la pantalla.
- **Sesiones:** cambiar el rol o la contraseña cierra las sesiones del usuario; el cierre de sus canales en vivo puede tardar hasta 25 s.

## 11. Siguiente paso

Tu visto bueno a las DP-01 a DP-10 (y el «pero» de la contraseña) → `plan.md` → tu visto bueno → `tasks.md` → código y pruebas; me detengo para tu revisión.
