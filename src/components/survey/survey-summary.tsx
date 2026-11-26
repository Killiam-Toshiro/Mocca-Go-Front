'use client';

import { useEffect, useRef } from 'react';
import { RatingStars } from '@/components/survey/rating-input';
import { formatOrderDate } from '@/lib/orders/format';
import type { SurveyData } from '@/lib/survey/use-submit-survey';

/** «Tu calificación» de solo lectura: no se edita una vez enviada. */
export function SurveySummary({
  survey,
  focusOnMount = false,
}: {
  survey: SurveyData;
  focusOnMount?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount) heading.current?.focus();
  }, [focusOnMount]);
  return (
    <section
      aria-labelledby="calificacion-titulo"
      className="grid gap-3 rounded-xl border bg-card p-4"
    >
      <h2
        id="calificacion-titulo"
        ref={heading}
        tabIndex={-1}
        className="font-display text-xl font-semibold outline-none"
      >
        Tu calificación
      </h2>
      <RatingStars value={survey.rating} />
      {survey.comment ? (
        <p className="text-sm whitespace-pre-line">{survey.comment}</p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Enviada el {formatOrderDate(survey.createdAt)}. ¡Gracias por contarnos!
      </p>
    </section>
  );
}
