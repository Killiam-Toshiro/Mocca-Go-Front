import { Star } from 'lucide-react';
import Link from 'next/link';
import { formatOrderDate } from '@/lib/orders/format';
import { ratingText } from '@/lib/surveys/filters';
import type { SurveyRow as Row } from '@/lib/surveys/use-surveys';

/** Una respuesta: estrellas con el número en texto y el comentario como texto plano (D-131). */
export function SurveyRow({ survey }: { survey: Row }) {
  return (
    <li className="grid gap-2 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/admin/pedidos/${survey.orderId}`}
          className="inline-flex min-h-12 items-center rounded-md font-display text-lg font-semibold text-brand-strong underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          Pedido #{survey.number}
        </Link>
        <span className="flex items-center gap-2 font-medium">
          <span aria-hidden className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={
                  n <= survey.rating
                    ? 'size-4 fill-chart-main text-chart-main'
                    : 'size-4 text-muted-foreground'
                }
              />
            ))}
          </span>
          <span>{ratingText(survey.rating)}</span>
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {survey.customer.name} · {survey.zoneName} ·{' '}
        {formatOrderDate(survey.createdAt)}
      </p>
      {survey.comment ? (
        <p className="break-words whitespace-pre-line">{survey.comment}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Sin comentario</p>
      )}
    </li>
  );
}
