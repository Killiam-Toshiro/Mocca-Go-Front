import { Alert } from '@/components/ui/alert';

/** Errores del servidor. `role="alert"` hace que el lector de pantalla los anuncie al aparecer. */
export function ErrorAlert({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <Alert variant="destructive">
      {messages.length === 1 ? (
        <p>{messages[0]}</p>
      ) : (
        <ul className="list-disc space-y-1 pl-4">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </Alert>
  );
}
