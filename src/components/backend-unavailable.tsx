import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/** Se muestra cuando el back no responde: la sesión puede seguir siendo válida, así que no se cierra. */
export function BackendUnavailable() {
  return (
    <main className="mx-auto max-w-md p-6">
      <Alert variant="destructive" role="alert">
        <AlertTitle>No pudimos conectar con el servidor</AlertTitle>
        <AlertDescription>
          Tu sesión sigue activa. Recarga la página en unos segundos.
        </AlertDescription>
      </Alert>
    </main>
  );
}
