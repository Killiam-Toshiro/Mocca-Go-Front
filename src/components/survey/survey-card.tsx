'use client';

import { LoaderCircle } from 'lucide-react';
import { useId, useState } from 'react';
import { FormField } from '@/components/form-field';
import { RatingInput } from '@/components/survey/rating-input';
import { SurveySummary } from '@/components/survey/survey-summary';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { Order } from '@/lib/orders/types';
import { COMMENT_MAX } from '@/lib/survey/rating';
import { useSubmitSurvey } from '@/lib/survey/use-submit-survey';

const CARD = 'grid gap-4 rounded-xl border bg-card p-4';

/**
 * Encuesta del pedido (DP-01): el formulario aparece con `entregado` + `survey === null`; con
 * `survey` se ve «Tu calificación». Los avisos («ya tenía respuesta», 409/404) viven aquí para
 * que no desaparezcan junto con el formulario.
 */
export function SurveyCard({ order }: { order: Order }) {
  const id = useId();
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [retryable, setRetryable] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sentNow, setSentNow] = useState(false);

  const submit = useSubmitSurvey(order.id, {
    onDone: (_survey, how) => {
      setErrors([]);
      setSentNow(true);
      if (how === 'already')
        setNotice(
          'Este pedido ya tenía una calificación; te mostramos la guardada.',
        );
      if (how === 'recovered')
        setNotice('Tu calificación sí se guardó. ¡Gracias!');
    },
    onFail: (error) => {
      if (error.kind === 'state' || error.kind === 'missing') {
        setNotice(error.messages.join(' '));
        setErrors([]);
        return;
      }
      setErrors(error.messages);
      setRetryable(error.kind === 'ambiguous');
    },
  });

  const tooLong = comment.trim().length > COMMENT_MAX;
  const noticeAlert = notice ? (
    <Alert
      variant="destructive"
      className="flex items-center justify-between gap-3"
    >
      <p>{notice}</p>
      <Button
        type="button"
        variant="outline"
        className="min-h-12"
        onClick={() => setNotice(null)}
      >
        Entendido
      </Button>
    </Alert>
  ) : null;

  if (order.survey)
    return (
      <div className="grid gap-3">
        {noticeAlert}
        <SurveySummary survey={order.survey} focusOnMount={sentNow} />
      </div>
    );

  if (order.status !== 'entregado') return noticeAlert;

  function send(event: React.FormEvent) {
    event.preventDefault();
    if (rating === null || tooLong || submit.pending) return;
    setErrors([]);
    void submit.run(rating, comment);
  }

  return (
    <div className="grid gap-3">
      {noticeAlert}
      <section aria-labelledby={`${id}-titulo`} className={CARD}>
        <h2 id={`${id}-titulo`} className="font-display text-xl font-semibold">
          ¿Qué tal estuvo tu pedido?
        </h2>
        <form onSubmit={send} noValidate className="grid gap-4">
          <RatingInput
            name={`${id}-rating`}
            value={rating}
            onChange={setRating}
            disabled={submit.pending}
          />
          <FormField
            id={`${id}-comment`}
            label="Comentario (opcional)"
            hint={`${String(comment.length)}/${String(COMMENT_MAX)}`}
            error={
              tooLong
                ? `El comentario no puede superar los ${String(COMMENT_MAX)} caracteres.`
                : undefined
            }
          >
            {(control) => (
              <textarea
                {...control}
                value={comment}
                rows={3}
                disabled={submit.pending}
                onChange={(event) => setComment(event.target.value)}
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 aria-invalid:border-destructive md:text-sm"
              />
            )}
          </FormField>
          <p className="text-sm text-muted-foreground">
            Al enviarla no podrás cambiarla.
          </p>
          {errors.length > 0 ? (
            <Alert variant="destructive" className="grid gap-1">
              {errors.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </Alert>
          ) : null}
          <Button
            type="submit"
            className="min-h-12 justify-self-start"
            disabled={rating === null || tooLong || submit.pending}
          >
            {submit.pending ? (
              <>
                <LoaderCircle className="animate-spin" aria-hidden />
                Enviando…
              </>
            ) : retryable && errors.length > 0 ? (
              'Reintentar'
            ) : (
              'Enviar calificación'
            )}
          </Button>
        </form>
      </section>
    </div>
  );
}
