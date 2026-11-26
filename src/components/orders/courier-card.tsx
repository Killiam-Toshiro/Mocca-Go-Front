import { MessageCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatTime, safeWhatsappUrl } from '@/lib/orders/format';
import type { Order } from '@/lib/orders/types';

/** Repartidor y hora estimada; solo existen mientras el pedido va «en camino» (D-045). */
export function CourierCard({ delivery }: { delivery: Order['delivery'] }) {
  const { courier, etaAt } = delivery;
  if (!courier && !etaAt) return null;
  const whatsapp = safeWhatsappUrl(courier?.whatsappUrl);
  return (
    <section
      aria-labelledby="repartidor-titulo"
      className="grid gap-2 rounded-xl border bg-card p-4"
    >
      <h2 id="repartidor-titulo" className="font-display text-xl font-semibold">
        Tu repartidor
      </h2>
      {etaAt ? (
        <p>
          Llegada estimada: <strong>{formatTime(etaAt)}</strong>
        </p>
      ) : null}
      {courier ? (
        <>
          <p>{courier.fullName}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`tel:${courier.phone}`}>
                <Phone aria-hidden />
                {courier.phone}
              </a>
            </Button>
            {whatsapp ? (
              <Button asChild variant="outline" size="sm">
                <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden />
                  WhatsApp
                </a>
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
