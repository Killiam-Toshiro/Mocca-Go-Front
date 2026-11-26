import type { ReactNode } from 'react';

/** Cifra grande con su nombre; el valor puede ser «Sin datos». */
export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="grid content-start gap-1 rounded-lg border bg-background p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-display text-2xl font-semibold tabular-nums">
        {value}
      </dd>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3">
      {children}
    </dl>
  );
}

/** Tarjeta de una sección del panel. */
export function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid min-w-0 gap-4 rounded-xl border bg-card p-4 shadow-sm md:p-6"
    >
      <header className="grid gap-1">
        <h2 id={id} className="font-display text-xl font-semibold">
          {title}
        </h2>
        {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function NoData({
  children = 'Sin datos en este periodo',
}: {
  children?: string;
}) {
  return (
    <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

/** Los mismos datos de una gráfica, en tabla (para lectores de pantalla y para copiar). */
export function DataTable({
  summary,
  caption,
  head,
  rows,
}: {
  summary: string;
  caption: string;
  head: string[];
  rows: string[][];
}) {
  return (
    <details className="rounded-lg border bg-background">
      <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {summary}
      </summary>
      <div className="max-h-80 overflow-auto px-4 pb-4">
        <table className="w-full min-w-max text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b">
              {head.map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={`py-2 pr-4 font-medium ${i > 0 ? 'text-right' : ''}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]} className="border-b last:border-0">
                {r.map((c, i) =>
                  i === 0 ? (
                    <th key={c} scope="row" className="py-2 pr-4 font-normal">
                      {c}
                    </th>
                  ) : (
                    <td key={i} className="py-2 pr-4 text-right tabular-nums">
                      {c}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
