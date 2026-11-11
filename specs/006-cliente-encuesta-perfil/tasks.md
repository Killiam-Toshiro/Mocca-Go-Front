# Tareas 006 — Cliente: encuesta y perfil

Plan: `plan.md` (aprobado el 2026-11-11).

- [x] T-01 Mock: `survey` en `orders.ts`, `profile.ts` (perfil y contraseña), rutas y `GET /customers/me` con fechas; `profile.test.ts` y pruebas de encuesta en `orders.test.ts` — CA-16
- [x] T-02 Encuesta (lógica): `rating`, `errors` con pruebas — CA-03, CA-05
- [x] T-03 Encuesta (datos): `useSubmitSurvey` con pruebas — CA-04, CA-05, CA-12
- [x] T-04 Encuesta (interfaz): `RatingInput`, `SurveyCard`, `SurveySummary`, integración y región de anuncio en el detalle — CA-02, CA-03, CA-04, CA-06, CA-13
- [x] T-05 Perfil (lógica y datos): `useProfile` (unifica `useDisplayName`), esquemas, errores, `useUpdateProfile`, `useChangePassword` con pruebas — CA-09 a CA-12
- [x] T-06 Perfil (interfaz): `ProfileView`, `ProfileForm`, `PasswordForm`, ruta `/cliente/perfil` y navegación — CA-01, CA-08 a CA-11, CA-13
- [x] T-07 Pasarela: `json.test.ts` (403 no cierra la sesión) y `route.test.ts` (`PATCH /api/auth/password` y `/api/customers/me`) — CA-11
- [x] T-08 E2E `survey.spec.ts` y `profile.spec.ts` (escritorio y 360 px) — CA-01 a CA-14
- [x] T-09 Verificación completa y `docs/commits/006.md` — CA-15
- [ ] T-10 Verificación manual contra el back real (spec §8; la haces tú)

## Desviaciones respecto al plan
- Los inputs de contraseña **no** se deshabilitan mientras se envía (solo el botón): un campo deshabilitado no puede recibir el foco tras el 403 (lo detectó el E2E).
- El aviso «Guardamos tus cambios» se apaga con un `onChange` del formulario (no con el estado «sucio»), para que reciba el foco una sola vez tras guardar.
- `useProfile` reintenta una sola vez los errores 5xx y de red antes de mostrar «Reintentar» (como `useOrder`); `useDisplayName` hereda ese comportamiento y ahora usa `handleUnauthorized`.
- La región de anuncio de «entregado» se prueba con la caché invalidada (cambio de estado) y en E2E con el canal en vivo del mock.
- `role-panel.test.tsx` actualizado: «Mi perfil» ya no es una sección futura.
