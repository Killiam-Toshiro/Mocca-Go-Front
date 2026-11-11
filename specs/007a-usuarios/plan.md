# Plan 007a — Admin: usuarios

**Spec:** `spec.md` (v3, aprobada el 2026-11-11, DP-01 a DP-11) · **Estado:** aprobado el 2026-11-11 e implementado · **Siguiente paso tras aprobar:** `tasks.md` → código y pruebas

---

## 1. Enfoque

Sin dependencias nuevas ni cambios en el back. Se reutiliza lo construido: `requestJson`, `ApiError`/`describeApiError`, `FormField`, `PasswordInput`, `Select`, `Input`, `Alert`, `DialogPanel`, `Pagination`, `Skeleton`, el formulario de contraseña del 006 y el patrón de hooks de 004b–006 (marca síncrona anti doble clic, `onDone`/`onFail` por `ref`, sin reintento automático, comprobar el estado tras un corte de red). La lista usa el patrón de `useMovements` (`keepPreviousData`, clave con los parámetros).

Orden: **mock** → **lógica y hooks** → **pantalla de usuarios** → **«Mi cuenta» y navegación** → **E2E** → verificación y documentos.

## 2. Hallazgos que condicionan el plan

1. **Sin rutas nuevas:** las 6 operaciones de `users` y `/auth/password` ya están en `routes.generated.ts` (`own: false`); la pasarela comodín las sirve. Se fija con una prueba de `route.test.ts` (`GET /api/users?search=…&role=…`, `PATCH /api/users/{id}/role`).
2. **El 403 del back no cierra la sesión** (ya fijado en el 006); el 401 sí: tras cambiar el rol o la contraseña de otro usuario, **su** siguiente petición da 401 y vuelve al login. En el mock esto exige que el almacén de usuarios **invalide los tokens** del usuario editado.
3. **El mock hoy es fijo:** `STAFF` es una constante y `GET /users` devuelve `[]`. Se reemplaza por un almacén con estado (`users.ts`) del que también sale el login; hay que revisar cómo valida el login la contraseña para que «restablecer» y «Mi cuenta» tengan efecto real (tarea de la fase 1).
4. **Nombre del cliente:** `fullName` es obligatorio en `POST /customers` y llega en `GET /users` solo para clientes; en el mock los clientes registrados deben aparecer en el listado (se alimenta del almacén de clientes existente).
5. **`maxLength` del nombre:** el OpenAPI dice 100 para ambos roles; el límite real depende del rol (80 personal, 100 cliente) y lo aplica el esquema del front por rol.
6. **Cuenta propia:** la sesión (`useSession`) da `user.id`; la fila con ese `id` es de solo lectura (DP-05). El mock devuelve los mismos 409 que el back si se fuerza la llamada.
7. **Navegación:** `app-shell.test.tsx` cuenta 6 entradas «Próximamente» del admin; al habilitar «Usuarios» pasan a 5. «Mi cuenta» se añade a admin, operador y repartidor (`nav.test.ts`, `role-panel.test.tsx`).
8. **Búsqueda con espera:** no existe un hook de debounce; se crea `useDebouncedValue` (400 ms) y la consulta usa el valor diferido; el campo muestra lo que se teclea de inmediato.

## 3. Archivos

**Mock (`tests/mock-api/`)**
- `users.ts` (nuevo): `createUserStore(customers, sessions)`: personal sembrado (admin, operador, repartidor, repartidor2, corta) con contraseñas, clientes tomados del almacén de clientes; `list({ page, limit, search, role })` con las reglas del back (orden `username` luego `id`; `search` recortado, vacío ignorado, ≤ 100, sin NUL, parcial sin mayúsculas **con tildes**, `%_\` literales, dígitos del teléfono con 3+ dígitos, correo solo en clientes; `role` por comas sin repetidos, 400 si es inválido, vacío o con coma sobrante); `create`; `update` (personal: nombre 2–80, usuario con patrón, 409 repetido; cliente: nombre 2–100 y teléfono E.164, `username` → 400 con el texto del back, contraseña sí; sin tocar `updatedAt` si nada cambia; contraseña nueva revoca las demás sesiones y reinicia el bloqueo); `changeRole` (orden de reglas del back: 404, cliente 409, mismo rol 200, repartidor sin datos 400, último admin 409, propio rol 409; revoca todas las sesiones); `remove` (404, último admin, propio usuario, historial con el texto nuevo; el historial se marca desde el almacén de pedidos/movimientos o con un indicador de prueba).
- `server.mts`: rutas `GET/POST /users`, `PATCH /users/:id`, `PATCH /users/:id/role`, `DELETE /users/:id`; `STAFF` y el login salen del almacén; reinicio con el reinicio general; ganchos de prueba (`/__control`) para sembrar un usuario con historial y simular corte de red.
- `users.test.ts`: reglas del almacén (filtro, búsqueda, edición de cliente, cambio de rol con revocación, borrado).

**Lógica y datos (`src/lib/users/`)**
- `types.ts`: `User`, `UserPage`, `StaffRole`, tomados de `schema.d.ts`.
- `roles.ts`: etiquetas e íconos de rol (texto + ícono, D-046), `ROLE_FILTERS` (`personal` = `admin,operador,repartidor`, `todos`, cada rol, `cliente`), `roleParam(filter)`.
- `generic-password.ts`: `GENERIC_PASSWORD = 'clave-generica'`.
- `schemas.ts`: `usernameSchema` (patrón del back), `createUserSchema` (repartidor exige nombre y teléfono), `editSchema` por rol (nombre 80/100; usuario solo personal), `changedUserFields(original, values, role)` (solo lo modificado), `resetPasswordSchema` (12–128), `changeRoleSchema`.
- `errors.ts`: `describeUserError(error, context)` → `{ kind: 'duplicate' | 'field' | 'missing' | 'conflict' | 'ambiguous' | 'other', fields, messages }`, repartiendo los 400 por campo según el texto del back y mostrando siempre el mensaje del back en 404/409; `AMBIGUOUS_USER`.
- `use-debounced-value.ts`: `useDebouncedValue(value, 400)`.
- `use-users.ts`: `USERS_PAGE_SIZE = 20`, `usersUrl({ page, search, role })`, `useUsers(filter)` con `keepPreviousData`, sin reintento de 4xx; la clave incluye página, búsqueda y rol.
- `use-create-user.ts`: `POST /users`; sin reintento; tras corte de red consulta `GET /users?search=<usuario>&role=<rol>` y, si existe, da por creado (`how: 'exists'`); si no, `onFail` ambiguo; invalida `['users']`.
- `use-update-user.ts`: `PATCH /users/{id}` (datos y/o contraseña); tras corte consulta y compara; invalida `['users']`.
- `use-change-role.ts`: `PATCH /users/{id}/role`; tras corte consulta; invalida `['users']`.
- `use-delete-user.ts`: `DELETE /users/{id}`; tras corte, si el usuario ya no aparece se da por eliminado; invalida `['users']`.
- Todos con marca síncrona `useRef`, `latest` ref para callbacks y sin estado de contraseñas.

**Componentes (`src/components/users/`)**
- `users-view.tsx`: título, botón «Crear usuario», filtros, lista, `Pagination` (`total`, `pageSize`, etiqueta «Páginas de usuarios»), esqueleto, error con «Reintentar», vacío, región `status` «N resultados», aviso «La búsqueda distingue tildes»; raíz `mx-auto w-full max-w-5xl`.
- `users-filters.tsx`: `Buscar usuario` (`type=search`, con espera) y `Rol` (`Select`).
- `user-list.tsx`: tabla (≥ `md`) y tarjetas (móvil) con `UserRow`; fila propia con «Tú» y explicación; clientes con correo y acciones limitadas.
- `user-panel.tsx`: panel (`DialogPanel`) de crear/editar con `FormField`, `PasswordInput` (prellenada con la clave genérica al crear), `RoleSection` (cambiar rol), `ResetPasswordSection` (campo vacío + «Usar clave genérica» + advertencia) y `DeleteSection` (confirmación en línea); foco al abrir y de vuelta a la fila al cerrar; avisos «Entendido» para 404/409.
- `components/account/account-view.tsx`: usuario, rol y `PasswordForm` del 006.

**Rutas y navegación**
- `app/(app)/admin/usuarios/page.tsx` (+ `metadata`); `app/(app)/{admin,operador,repartidor}/cuenta/page.tsx`.
- `lib/auth/nav.ts`: «Usuarios» habilitado; «Mi cuenta» en admin, operador y repartidor; actualizar `nav.test.ts`, `app-shell.test.tsx` (5 «Próximamente») y `role-panel.test.tsx`.

**Pruebas y E2E**
- `src/lib/users/{schemas,errors,roles}.test.ts`, `use-debounced-value.test.ts`, `hooks.test.tsx` (lista y parámetros, crear con corte, editar solo lo modificado, rol, eliminar, doble clic, sin reintento).
- `src/components/users/{users-view,user-panel,users-filters}.test.tsx`; `src/components/account/account-view.test.tsx`.
- `route.test.ts`: `GET /api/users?search&role` y `PATCH /api/users/{id}/role` por la pasarela.
- `e2e/users.spec.ts` (escritorio y móvil 360) y `e2e/account.spec.ts`. Cada prueba crea sus propios usuarios con nombres únicos para no mezclarse en paralelo.

## 4. Mapa CA → pruebas

| CA | Pruebas |
|---|---|
| CA-01 | `nav.test.ts`, `app-shell.test.tsx`; E2E de guardas de `/admin/usuarios` (visitante y otros roles). |
| CA-02 | `users-view.test.tsx` (columnas, esqueleto, error + «Reintentar», vacío, «Tú», clientes), `hooks.test.tsx` (URL con `page`, `limit=20`), E2E. |
| CA-03 | `users-filters.test.tsx`, `use-debounced-value.test.ts`, `roles.test.ts` (`roleParam`), `users-view.test.tsx` (vuelta a la página 1, lista previa mientras carga, «N resultados», aviso de tildes), E2E (búsqueda por teléfono con espacios, por correo, por rol). |
| CA-04 | `schemas.test.ts`, `user-panel.test.tsx` (prellenado, repartidor exige datos, aviso final), `hooks.test.tsx` (cuerpo exacto), E2E. |
| CA-05 | `schemas.test.ts` (`changedUserFields`, 80 vs 100), `user-panel.test.tsx` (habilitado solo con cambios, cliente sin usuario ni correo, 400 en su campo), E2E. |
| CA-06 | `schemas.test.ts`, `user-panel.test.tsx` (campo vacío, «Usar clave genérica», advertencia, limpieza tras terminar y tras corte), `hooks.test.tsx`, E2E. |
| CA-07 | `user-panel.test.tsx` (aviso de cierre de sesión, datos de repartidor, sin cambio de rol propio ni de clientes), `hooks.test.tsx`, E2E. |
| CA-08 | `user-panel.test.tsx` (confirmación en línea, avisos «Entendido»), `errors.test.ts` (texto del back sin comparar), E2E (cada 409). |
| CA-09 | `errors.test.ts`, `user-panel.test.tsx`, E2E (usuario repetido). |
| CA-10 | `hooks.test.tsx` (doble clic, sin reintento, corte con y sin efecto), E2E con `page.route`. |
| CA-11 | E2E (repartidor con perfil incompleto → 409 al salir; el admin completa los datos → sale). |
| CA-12 | E2E (cliente ve en «Mi perfil» lo que editó el admin; operador con sesión abierta pasa al login tras el cambio de rol). |
| CA-13 | Pruebas de componente (nombres, `aria-describedby`, `aria-live`, foco); revisión con lector de pantalla (tuya). |
| CA-14 | E2E 360 px: sin desborde, botones y filas ≥ 48 px; capturas que reviso yo. |
| CA-15 | Local: `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `audit`; E2E completo en la nube. |
| CA-16 | Todo lo anterior + `users.test.ts` del mock. |
| CA-17 | `account-view.test.tsx`, `nav.test.ts`, E2E (personal creado con la clave genérica entra y la cambia; 403 con la actual incorrecta). |

## 5. Orden de trabajo

1. **Mock:** `users.ts` + `users.test.ts`; rutas y login desde el almacén en `server.mts`; que el resto de pruebas sigan en verde.
2. **Lógica:** tipos, roles, clave genérica, esquemas, errores, debounce, `useUsers` y hooks de acciones, con sus pruebas.
3. **Pantalla de usuarios:** `UsersView`, filtros, lista, panel (crear, editar, restablecer, rol, eliminar), ruta y navegación, pruebas.
4. **«Mi cuenta»:** vista, tres rutas, navegación y pruebas.
5. `route.test.ts` (pasarela) y E2E de usuarios y cuenta (escritorio y 360 px), capturas.
6. Verificación completa, `tasks.md`, decisiones D-105 en adelante, `docs/commits/007a.md`, README. **Me detengo para tu revisión; sin commit ni push.**

## 6. Riesgos y cómo se cubren

- **Mock fiel al back:** los textos y el orden de reglas salen del contrato de tu incremento 020; si el back real difiere, se corrige el mock tras tu prueba manual (§9 del spec).
- **Clave genérica visible en el código:** es una constante pública del front y de la documentación; no es un secreto. Se documenta el riesgo y que el uso es solo para el primer ingreso.
- **Revocación de sesiones en el mock:** el almacén y el servidor comparten el mapa de sesiones; la prueba E2E de CA-12 lo ejerce de punta a punta.
- **Doble envío / carreras:** marca síncrona; el 409/404 del back se explica y se refresca la lista.
- **Foco y anuncios:** foco al panel al abrir y a la fila al cerrar; los resultados se anuncian por `aria-live` sin mover el foco.
- **Búsqueda con tildes:** limitación del back, avisada en pantalla.

## Siguiente paso

Tu visto bueno a este plan → `tasks.md` → código y pruebas.
