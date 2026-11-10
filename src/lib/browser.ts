/**
 * Navegación completa (recarga). Se usa tras iniciar o cerrar sesión: así el servidor
 * vuelve a evaluar los layouts con las cookies nuevas y no queda caché del router.
 * Vive en un módulo aparte para poder sustituirlo en las pruebas.
 */
export function navigate(url: string): void {
  window.location.assign(url);
}

/** Ruta y consulta actuales, para volver a ellas tras iniciar sesión. */
export function currentPath(): string {
  return `${window.location.pathname}${window.location.search}`;
}
