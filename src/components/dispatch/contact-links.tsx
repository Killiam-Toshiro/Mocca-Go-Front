import { MessageCircle, Phone } from 'lucide-react';
import { telHref, whatsappHref } from '@/lib/dispatch/contact';

const LINK =
  'inline-flex min-h-12 items-center gap-2 rounded-lg border bg-card px-3 text-base font-medium text-brand-strong outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Llamar o escribir por WhatsApp al cliente (D-DP-06); si el número no tiene la forma esperada, texto plano. */
export function ContactLinks({ name, phone }: { name: string; phone: string }) {
  const tel = telHref(phone);
  const whatsapp = whatsappHref(phone);
  return (
    <div className="grid gap-2">
      <p className="text-base">
        <span className="font-semibold">{name}</span>
        {tel ? null : <span className="text-muted-foreground"> · {phone}</span>}
      </p>
      {tel || whatsapp ? (
        <div className="flex flex-wrap gap-2">
          {tel ? (
            <a href={tel} className={LINK}>
              <Phone className="size-4" aria-hidden />
              Llamar {phone}
            </a>
          ) : null}
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className={LINK}
            >
              <MessageCircle className="size-4" aria-hidden />
              WhatsApp
              <span className="sr-only"> con {name}</span>
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
