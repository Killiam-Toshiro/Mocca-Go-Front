'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { describeApiError, isApiError } from '@/lib/api/errors';

export type JobState =
  | { status: 'idle' }
  | { status: 'working'; done: number; total: number }
  | { status: 'done'; name: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export interface JobContext {
  signal: AbortSignal;
  onProgress: (done: number, total: number) => void;
}

/**
 * Una exportación a la vez (guarda síncrona contra el doble clic), con avance y cancelación (D-136).
 * Cancelar no descarga nada; un error no deja un archivo a medias.
 */
export function useExportJob() {
  const [state, setState] = useState<JobState>({ status: 'idle' });
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );

  const run = useCallback(
    async (task: (context: JobContext) => Promise<string>) => {
      if (busy.current) return;
      busy.current = true;
      const abort = new AbortController();
      controller.current = abort;
      setState({ status: 'working', done: 0, total: 0 });
      try {
        const name = await task({
          signal: abort.signal,
          onProgress: (done, total) => {
            if (!abort.signal.aborted)
              setState({ status: 'working', done, total });
          },
        });
        setState({ status: 'done', name });
      } catch (error) {
        if (abort.signal.aborted) setState({ status: 'cancelled' });
        else
          setState({
            status: 'error',
            message: isApiError(error)
              ? describeApiError(error).join(' ')
              : 'No se pudo preparar el archivo. Intenta de nuevo.',
          });
      } finally {
        busy.current = false;
        controller.current = null;
      }
    },
    [],
  );

  const cancel = useCallback(() => controller.current?.abort(), []);
  const reset = useCallback(() => setState({ status: 'idle' }), []);
  return { state, run, cancel, reset };
}
