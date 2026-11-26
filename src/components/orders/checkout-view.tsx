'use client';

import { useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DeliveryFields,
  type DeliveryErrors,
  type DeliveryValues,
} from '@/components/orders/delivery-fields';
import { CardField } from '@/components/orders/card-field';
import { OrderSummary } from '@/components/orders/order-summary';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { reconcile } from '@/lib/cart/cart';
import { clearCart, syncWithMenu } from '@/lib/cart/store';
import { useCart } from '@/lib/cart/use-cart';
import { formatCOP } from '@/lib/menu/format';
import { useMenu } from '@/lib/menu/use-menu';
import { clearAttempt, getAttemptKey } from '@/lib/orders/attempt';
import { buildOrderBody, orderFingerprint } from '@/lib/orders/body';
import { isValidCard } from '@/lib/orders/card';
import {
  clearDraft,
  loadDraft,
  reconcileDraft,
  saveDraft,
} from '@/lib/orders/draft';
import { describeOrderError, type OrderError } from '@/lib/orders/errors';
import { useCreateOrder } from '@/lib/orders/use-create-order';
import { useZones } from '@/lib/orders/use-zones';
import { useHydrated } from '@/lib/use-hydrated';

const EMPTY: DeliveryValues = {
  zoneId: '',
  pointId: '',
  floor: '',
  deliveryNote: '',
  note: '',
};

/** Página de pedido: entrega, tarjeta de demostración y «Pagar» (D-039 a D-042). */
export function CheckoutView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hydrated = useHydrated();
  const cart = useCart();
  const menu = useMenu();
  const zones = useZones();
  const create = useCreateOrder();

  const [values, setValues] = useState<DeliveryValues>(EMPTY);
  const [card, setCard] = useState('');
  const [errors, setErrors] = useState<DeliveryErrors & { card?: string }>({});
  const [failure, setFailure] = useState<OrderError | null>(null);
  const [restored, setRestored] = useState(false);
  const submitting = useRef(false);
  const done = useRef(false);
  const focusAfter = useRef<string | null>(null);

  const view = useMemo(() => reconcile(cart, menu.data), [cart, menu.data]);

  useEffect(() => {
    if (menu.data) syncWithMenu(menu.data);
  }, [menu.data]);

  // Carrito vacío → al menú (solo cuando ya se leyó el almacenamiento y no acabamos de pagar).
  useEffect(() => {
    if (hydrated && cart.length === 0 && !done.current) {
      router.replace('/cliente/menu?vacio=1');
    }
  }, [hydrated, cart.length, router]);

  // Restaurar el borrador (sin tarjeta) la primera vez que llegan las zonas. Se ajusta
  // durante el render (patrón de React para estado derivado) y no en un efecto.
  if (!restored && zones.data) {
    setRestored(true);
    const draft = reconcileDraft(loadDraft(), zones.data);
    if (draft) {
      const zone = zones.data.find((z) =>
        z.points.some((p) => p.id === draft.pointId),
      );
      setValues({
        zoneId: zone?.id ?? '',
        pointId: draft.pointId,
        floor: draft.floor === null ? '' : String(draft.floor),
        deliveryNote: draft.deliveryNote,
        note: draft.note,
      });
    }
  }

  useEffect(() => {
    if (!create.isPending && focusAfter.current) {
      document.getElementById(focusAfter.current)?.focus();
      focusAfter.current = null;
    }
  });

  // Guardar el borrador mientras se edita.
  useEffect(() => {
    if (!restored || done.current || !values.pointId) return;
    saveDraft({
      pointId: values.pointId,
      floor: values.floor === '' ? null : Number(values.floor),
      deliveryNote: values.deliveryNote,
      note: values.note,
    });
  }, [values, restored]);

  const point = zones.data
    ?.flatMap((z) => z.points)
    .find((p) => p.id === values.pointId);

  function change(patch: Partial<DeliveryValues>) {
    setValues((current) => ({ ...current, ...patch }));
    setErrors({});
  }

  function validate(): boolean {
    const next: DeliveryErrors & { card?: string } = {};
    if (!values.zoneId) next.zone = 'Elige una zona.';
    if (!values.pointId) next.point = 'Elige un punto de entrega.';
    if (point?.floors != null && !values.floor) next.floor = 'Elige un piso.';
    if (!isValidCard(card)) next.card = 'Escribe los 16 dígitos de la tarjeta.';
    setErrors(next);
    const first = next.zone
      ? 'zone'
      : next.point
        ? 'point'
        : next.floor
          ? 'floor'
          : next.card
            ? 'card-number'
            : null;
    if (first) document.getElementById(first)?.focus();
    return first === null;
  }

  async function submit(event?: { preventDefault: () => void }) {
    event?.preventDefault();
    if (submitting.current || create.isPending) return;
    setFailure(null);
    if (!view.canContinue || !validate()) return;

    const body = buildOrderBody(
      view.rows.map((row) => ({
        productId: row.line.productId,
        quantity: row.line.quantity,
      })),
      {
        pointId: values.pointId,
        floor: values.floor === '' ? null : Number(values.floor),
        deliveryNote: values.deliveryNote,
        note: values.note,
      },
      card,
    );
    const key = getAttemptKey(orderFingerprint(body));

    submitting.current = true;
    try {
      const order = await create.mutateAsync({ body, key });
      done.current = true;
      clearCart();
      clearAttempt();
      clearDraft();
      setCard('');
      create.reset();
      router.replace(`/cliente/pedidos/${order.id}?nuevo=1`);
    } catch (error) {
      const described = describeOrderError(error);
      if (described.kind === 'card') {
        setErrors({
          card: described.messages[0] ?? 'La tarjeta fue rechazada.',
        });
        // Los campos siguen deshabilitados hasta que termine el envío: se enfoca después.
        focusAfter.current = 'card-number';
      } else {
        setFailure(described);
        if (described.kind === 'conflict') {
          void queryClient.invalidateQueries({ queryKey: ['menu'] });
          void queryClient.invalidateQueries({ queryKey: ['zones'] });
        }
      }
      create.reset();
    } finally {
      submitting.current = false;
    }
  }

  if (!hydrated || cart.length === 0) {
    return (
      <div className="grid gap-4" aria-busy="true">
        <h1 className="font-display text-3xl font-semibold">Tu pedido</h1>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const pending = create.isPending;
  return (
    <div className="grid gap-6">
      <h1 className="font-display text-3xl font-semibold">Tu pedido</h1>

      {!menu.data && menu.isError ? (
        <Alert variant="destructive" className="grid gap-2">
          <p>No pudimos actualizar los precios ni la disponibilidad.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => void menu.refetch()}
          >
            Reintentar
          </Button>
        </Alert>
      ) : null}

      {view.unavailableCount > 0 && menu.data ? (
        <Alert variant="destructive" className="grid gap-2">
          <p>
            Hay productos agotados o retirados en tu carrito. Quítalos para
            poder pagar.
          </p>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="justify-self-start"
          >
            <Link href="/cliente/menu">Volver al menú</Link>
          </Button>
        </Alert>
      ) : null}

      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="md:sticky md:top-4 md:order-2">
          <OrderSummary view={view} />
        </div>

        <form
          noValidate
          onSubmit={(event) => void submit(event)}
          className="grid gap-6"
        >
          <fieldset className="grid gap-4" disabled={pending}>
            <legend className="mb-2 font-display text-xl font-semibold">
              Entrega
            </legend>
            {zones.isError ? (
              <Alert variant="destructive" className="grid gap-2">
                <p>No pudimos cargar los puntos de entrega.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-self-start"
                  onClick={() => void zones.refetch()}
                >
                  Reintentar
                </Button>
              </Alert>
            ) : zones.data ? (
              <DeliveryFields
                zones={zones.data}
                values={values}
                errors={errors}
                disabled={pending}
                onChange={change}
              />
            ) : (
              <Skeleton className="h-40 w-full" />
            )}
          </fieldset>

          <fieldset className="grid gap-4" disabled={pending}>
            <legend className="mb-2 font-display text-xl font-semibold">
              Pago
            </legend>
            <CardField
              value={card}
              onChange={(next) => {
                setCard(next);
                setErrors({});
              }}
              error={errors.card}
              disabled={pending}
            />
          </fieldset>

          {failure ? (
            <Alert variant="destructive" className="grid gap-2">
              {failure.messages.map((message) => (
                <p key={message}>{message}</p>
              ))}
              {failure.kind === 'conflict' ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="justify-self-start"
                >
                  <Link href="/cliente/menu">Revisar mi carrito</Link>
                </Button>
              ) : null}
            </Alert>
          ) : null}

          <div role="status" aria-live="polite" className="sr-only">
            {pending ? 'Procesando el pago…' : ''}
          </div>

          <Button
            type="submit"
            className="h-12 text-base"
            disabled={pending || !view.canContinue}
          >
            {pending ? (
              <>
                <LoaderCircle className="animate-spin" aria-hidden />
                Procesando…
              </>
            ) : (
              `Pagar ${formatCOP(view.subtotal)}`
            )}
          </Button>
          {failure &&
          (failure.kind === 'network' || failure.kind === 'other') ? (
            <p className="text-sm text-muted-foreground">
              Si el cobro no se completó, puedes volver a pulsar «Pagar»: no se
              cobrará dos veces.
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
