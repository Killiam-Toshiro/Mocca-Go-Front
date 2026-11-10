/**
 * Se ejecuta una vez al arrancar el servidor de Next: una configuración
 * inválida debe impedir el arranque con un mensaje claro, no fallar en la
 * primera petición.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getEnv } = await import('./lib/server/env');
    getEnv();
  }
}
