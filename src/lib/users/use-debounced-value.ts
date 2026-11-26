'use client';

import { useEffect, useState } from 'react';

/** Devuelve `value` tras `delayMs` sin cambios (la búsqueda del servidor no se dispara por tecla). */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
