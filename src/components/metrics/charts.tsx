'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCOP } from '@/lib/menu/format';
import { formatCount, formatDay } from '@/lib/metrics/format';
import type { DailyPoint, Metrics } from '@/lib/metrics/types';

/**
 * Gráficas de Recharts (D-129). Este archivo se carga aparte (`React.lazy`) para que la
 * librería no pese en las demás pantallas. Colores solo con tokens; sin animación.
 */
const AXIS = {
  tick: { fill: 'var(--muted-foreground)', fontSize: 12 },
  stroke: 'var(--border)',
} as const;

function compactCOP(v: number): string {
  if (v >= 1_000_000)
    return `$${String(Math.round(v / 100_000) / 10)} M`.replace('.', ',');
  if (v >= 1000) return `$${String(Math.round(v / 1000))} mil`;
  return `$${String(v)}`;
}

const TOOLTIP = {
  contentStyle: {
    background: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--popover-foreground)',
  },
} as const;

export function SalesChart({ daily }: { daily: DailyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDay}
          interval="preserveStartEnd"
          minTickGap={24}
          {...AXIS}
        />
        <YAxis tickFormatter={compactCOP} width={64} {...AXIS} />
        <Tooltip
          {...TOOLTIP}
          labelFormatter={(d) => formatDay(String(d))}
          formatter={(v) => [formatCOP(Number(v)), 'Ventas']}
        />
        <Bar
          dataKey="revenue"
          name="Ventas"
          fill="var(--chart-main)"
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RatingChart({
  distribution,
}: {
  distribution: Metrics['satisfaction']['distribution'];
}) {
  const data = ([5, 4, 3, 2, 1] as const).map((n) => ({
    label: `${String(n)} ${n === 1 ? 'estrella' : 'estrellas'}`,
    count: distribution[String(n) as '1'],
  }));
  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 36, left: 0, bottom: 0 }}
      >
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={86} {...AXIS} />
        <Tooltip
          {...TOOLTIP}
          cursor={false}
          formatter={(v) => [formatCount(Number(v)), 'Respuestas']}
        />
        <Bar
          dataKey="count"
          name="Respuestas"
          fill="var(--chart-main)"
          radius={[0, 3, 3, 0]}
          isAnimationActive={false}
        >
          <LabelList
            dataKey="count"
            position="right"
            fill="var(--foreground)"
            fontSize={12}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const OUTCOME_COLORS = {
  entregado: 'var(--chart-good)',
  no_entregado: 'var(--chart-bad)',
  cancelado: 'var(--chart-neutral)',
  enCurso: 'var(--chart-main)',
} as const;

export function OutcomesChart({ outcomes }: { outcomes: Metrics['outcomes'] }) {
  const data = [
    { key: 'entregado', label: 'Entregados', count: outcomes.entregado },
    {
      key: 'no_entregado',
      label: 'No entregados',
      count: outcomes.no_entregado,
    },
    { key: 'cancelado', label: 'Cancelados', count: outcomes.cancelado },
    { key: 'enCurso', label: 'En curso', count: outcomes.enCurso },
  ] as const;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 36, left: 0, bottom: 0 }}
      >
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={104} {...AXIS} />
        <Tooltip
          {...TOOLTIP}
          cursor={false}
          formatter={(v) => [formatCount(Number(v)), 'Pedidos']}
        />
        <Bar
          dataKey="count"
          name="Pedidos"
          radius={[0, 3, 3, 0]}
          isAnimationActive={false}
        >
          {data.map((d) => (
            <Cell key={d.key} fill={OUTCOME_COLORS[d.key]} />
          ))}
          <LabelList
            dataKey="count"
            position="right"
            fill="var(--foreground)"
            fontSize={12}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
