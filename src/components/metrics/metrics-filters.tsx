'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  PRESETS,
  activePreset,
  presetRange,
  validatePeriod,
  type Period,
  type PresetId,
} from '@/lib/metrics/period';
import type { AdminZone } from '@/lib/zones/types';

/** Periodo (atajos y personalizado) y zona. No consulta nada: avisa con `onChange` y la URL manda (D-130). */
export function MetricsFilters({
  period,
  zoneId,
  today,
  zones,
  onChange,
}: {
  period: Period;
  zoneId: string | null;
  today: string;
  zones: AdminZone[];
  onChange: (next: { period: Period; zoneId: string | null }) => void;
}) {
  const preset = activePreset(period, today);
  const [custom, setCustom] = useState(false);
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);
  const [error, setError] = useState<string | null>(null);
  const showCustom = custom || preset === null;

  function choose(id: PresetId) {
    const range = presetRange(id, today);
    setCustom(false);
    setError(null);
    setFrom(range.from);
    setTo(range.to);
    onChange({ period: range, zoneId });
  }

  function apply() {
    const problem = validatePeriod(from, to);
    setError(problem);
    if (!problem) onChange({ period: { from, to }, zoneId });
  }

  return (
    <div className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="grid gap-2">
        <p id="metrics-period-label" className="text-sm font-medium">
          Periodo
        </p>
        <div
          role="group"
          aria-labelledby="metrics-period-label"
          className="flex flex-wrap gap-2"
        >
          {PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              variant={preset === p.id && !showCustom ? 'default' : 'outline'}
              aria-pressed={preset === p.id && !showCustom}
              className="min-h-12"
              onClick={() => choose(p.id)}
            >
              {p.label}
            </Button>
          ))}
          <Button
            type="button"
            variant={showCustom ? 'default' : 'outline'}
            aria-pressed={showCustom}
            className="min-h-12"
            onClick={() => setCustom(true)}
          >
            Personalizado
          </Button>
        </div>
      </div>

      {showCustom ? (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="grid gap-1.5">
              <Label htmlFor="metrics-from">Desde</Label>
              <Input
                id="metrics-from"
                type="date"
                value={from}
                max={today}
                className="h-12"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'metrics-period-error' : undefined}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="metrics-to">Hasta</Label>
              <Input
                id="metrics-to"
                type="date"
                value={to}
                max={today}
                className="h-12"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'metrics-period-error' : undefined}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <Button type="button" className="min-h-12" onClick={apply}>
              Aplicar
            </Button>
          </div>
          {error ? (
            <p
              id="metrics-period-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid max-w-xs gap-1.5">
        <Label htmlFor="metrics-zone">Zona</Label>
        <Select
          id="metrics-zone"
          className="h-12"
          value={zoneId ?? ''}
          onChange={(e) => onChange({ period, zoneId: e.target.value || null })}
        >
          <option value="">Todas las zonas</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.active ? z.name : `${z.name} (inactiva)`}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
