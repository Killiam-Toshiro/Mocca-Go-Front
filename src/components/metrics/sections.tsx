import Link from 'next/link';
import { categoryLabel } from '@/lib/menu/categories';
import { formatCOP } from '@/lib/menu/format';
import {
  formatCount,
  formatDay,
  formatMinutes,
  formatPercent,
  formatRating,
} from '@/lib/metrics/format';
import type { Metrics } from '@/lib/metrics/types';
import { OutcomesChart, RatingChart, SalesChart } from './lazy-charts';
import { DataTable, NoData, Section, Stat, StatGrid } from './parts';

/** `empty` = ningún pedido creado en el periodo: se dice con texto y no se dibujan ceros engañosos (DP-05). */
export function SalesSection({
  data,
  empty,
}: {
  data: Metrics['sales'];
  empty: boolean;
}) {
  return (
    <Section id="m-ventas" title="Ventas" note="Pedidos con pago aprobado.">
      <StatGrid>
        <Stat label="Pedidos" value={formatCount(data.orders)} />
        <Stat
          label="Ingresos"
          value={empty ? 'Sin datos' : formatCOP(data.revenue)}
        />
        <Stat
          label="Ticket promedio"
          value={
            data.orders === 0 ? 'Sin datos' : formatCOP(data.averageTicket)
          }
        />
      </StatGrid>
      {empty ? (
        <NoData />
      ) : (
        <>
          <SalesChart
            daily={data.daily}
            label="Gráfica de barras: ventas por día en el periodo. Los mismos datos están en la tabla de abajo."
          />
          <DataTable
            summary="Ver ventas por día como tabla"
            caption="Ventas por día"
            head={['Día', 'Pedidos', 'Ventas']}
            rows={data.daily.map((d) => [
              formatDay(d.date),
              formatCount(d.orders),
              formatCOP(d.revenue),
            ])}
          />
        </>
      )}
    </Section>
  );
}

export function MarginSection({
  data,
  empty,
}: {
  data: Metrics['margin'];
  empty: boolean;
}) {
  return (
    <Section
      id="m-margen"
      title="Margen"
      note="Ingresos menos el costo variable de lo vendido."
    >
      <StatGrid>
        <Stat
          label="Ingresos"
          value={empty ? 'Sin datos' : formatCOP(data.revenue)}
        />
        <Stat
          label="Costo variable"
          value={empty ? 'Sin datos' : formatCOP(data.variableCost)}
        />
        <Stat
          label="Margen"
          value={empty ? 'Sin datos' : formatCOP(data.margin)}
        />
        <Stat
          label="Costo variable sobre ingresos"
          value={formatPercent(data.variableCostRate)}
        />
      </StatGrid>
      {empty || data.byCategory.length === 0 ? (
        <NoData />
      ) : (
        <DataTable
          summary="Ver margen por categoría"
          caption="Margen por categoría"
          head={['Categoría', 'Ingresos', 'Costo', 'Margen', '% costo']}
          rows={data.byCategory.map((c) => [
            categoryLabel(c.category),
            formatCOP(c.revenue),
            formatCOP(c.variableCost),
            formatCOP(c.margin),
            formatPercent(c.variableCostRate),
          ])}
        />
      )}
    </Section>
  );
}

export function DeliverySection({ data }: { data: Metrics['delivery'] }) {
  const t = data.totalMinutes;
  const s = data.stageMinutes;
  return (
    <Section
      id="m-entregas"
      title="Entregas"
      note={`«A tiempo» = reparto de ${String(data.onTimeThresholdMinutes)} minutos o menos.`}
    >
      <StatGrid>
        <Stat label="Pedidos entregados" value={formatCount(data.delivered)} />
        <Stat
          label="Entregados a tiempo"
          value={formatPercent(data.onTimeRate)}
        />
        <Stat label="Tiempo total promedio" value={formatMinutes(t.average)} />
        <Stat label="Tiempo total mediano" value={formatMinutes(t.median)} />
        <Stat label="El 90 % tarda menos de" value={formatMinutes(t.p90)} />
      </StatGrid>
      <h3 className="text-base font-semibold">Promedio por etapa</h3>
      <StatGrid>
        <Stat label="Cocina" value={formatMinutes(s.kitchen)} />
        <Stat label="Espera para salir" value={formatMinutes(s.waiting)} />
        <Stat label="Reparto" value={formatMinutes(s.delivery)} />
      </StatGrid>
      {data.byZone.length === 0 ? (
        <NoData>Sin entregas en este periodo</NoData>
      ) : (
        <DataTable
          summary="Ver tiempos por zona"
          caption="Tiempos de entrega por zona"
          head={[
            'Zona',
            'Entregados',
            'A tiempo',
            'Promedio',
            'Mediana',
            '90 %',
          ]}
          rows={data.byZone.map((z) => [
            z.zoneName,
            formatCount(z.delivered),
            formatPercent(z.onTimeRate),
            formatMinutes(z.totalMinutes.average),
            formatMinutes(z.totalMinutes.median),
            formatMinutes(z.totalMinutes.p90),
          ])}
        />
      )}
    </Section>
  );
}

export function SatisfactionSection({
  data,
  surveysHref,
}: {
  data: Metrics['satisfaction'];
  surveysHref: string;
}) {
  const d = data.distribution;
  return (
    <Section
      id="m-satisfaccion"
      title="Satisfacción"
      note="Calificaciones de pedidos entregados, de 1 a 5."
    >
      <StatGrid>
        <Stat label="Respuestas" value={formatCount(data.responses)} />
        <Stat
          label="Calificación promedio"
          value={
            data.average === null
              ? 'Sin datos'
              : `${formatRating(data.average)} de 5`
          }
        />
        <Stat
          label="Entregas que respondieron"
          value={formatPercent(data.responseRate)}
        />
      </StatGrid>
      {data.responses === 0 ? (
        <NoData>Sin respuestas en este periodo</NoData>
      ) : (
        <>
          <RatingChart
            distribution={d}
            label="Gráfica de barras: cuántas respuestas hay por calificación. Los mismos datos están en la tabla de abajo."
          />
          <DataTable
            summary="Ver distribución como tabla"
            caption="Respuestas por calificación"
            head={['Calificación', 'Respuestas']}
            rows={([5, 4, 3, 2, 1] as const).map((n) => [
              `${String(n)} de 5`,
              formatCount(d[String(n) as '1']),
            ])}
          />
        </>
      )}
      <Link
        href={surveysHref}
        className="min-h-12 content-center justify-self-start rounded-md text-sm font-medium text-brand-strong underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        Ver las encuestas de este periodo
      </Link>
    </Section>
  );
}

export function RetentionSection({ data }: { data: Metrics['retention'] }) {
  return (
    <Section
      id="m-recompra"
      title="Recompra"
      note="Clientes con pedidos aprobados en el periodo y cuántos pidieron dos veces o más."
    >
      <StatGrid>
        <Stat label="Clientes" value={formatCount(data.customers)} />
        <Stat
          label="Clientes recurrentes"
          value={formatCount(data.repeatCustomers)}
        />
        <Stat
          label="Tasa de recompra"
          value={
            data.customers === 0 ? 'Sin datos' : formatPercent(data.repeatRate)
          }
        />
      </StatGrid>
    </Section>
  );
}

export function OutcomesSection({
  data,
  empty,
}: {
  data: Metrics['outcomes'];
  empty: boolean;
}) {
  return (
    <Section
      id="m-resultado"
      title="Resultado de los pedidos"
      note="Cómo terminaron los pedidos creados en el periodo."
    >
      <StatGrid>
        <Stat label="Entregados" value={formatCount(data.entregado)} />
        <Stat label="No entregados" value={formatCount(data.no_entregado)} />
        <Stat label="Cancelados" value={formatCount(data.cancelado)} />
        <Stat
          label="En curso"
          value={formatCount(data.enCurso)}
          hint="Recibidos, en preparación, listos o en camino."
        />
      </StatGrid>
      {empty ? (
        <NoData />
      ) : (
        <OutcomesChart
          outcomes={data}
          label={`Gráfica de barras: ${String(data.entregado)} entregados, ${String(data.no_entregado)} no entregados, ${String(data.cancelado)} cancelados y ${String(data.enCurso)} en curso.`}
        />
      )}
    </Section>
  );
}
