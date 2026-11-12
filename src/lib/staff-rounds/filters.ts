export type RoundFilter = 'todas' | 'activa' | 'finalizada';

export const ROUND_FILTERS: readonly { value: RoundFilter; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'activa', label: 'Activas' },
  { value: 'finalizada', label: 'Finalizadas' },
];
