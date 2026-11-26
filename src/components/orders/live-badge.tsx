'use client';

import { LoaderCircle, Radio, RefreshCw } from 'lucide-react';
import { useLiveStatus } from '@/lib/orders/live';
import { cn } from '@/lib/utils';

/** Estado de la actualización automática, con ícono y texto (nunca solo color). */
export function LiveBadge({ className }: { className?: string }) {
  const status = useLiveStatus();
  if (status === 'off') return null;

  const base = cn(
    'inline-flex items-center gap-1.5 text-xs font-semibold',
    className,
  );
  if (status === 'live') {
    return (
      <span className={cn(base, 'text-brand-strong')}>
        <Radio className="size-3.5" aria-hidden />
        En vivo
      </span>
    );
  }
  if (status === 'stopped') {
    return (
      <span className={cn(base, 'text-muted-foreground')}>
        <RefreshCw className="size-3.5" aria-hidden />
        Se actualiza cada 15 s
      </span>
    );
  }
  return (
    <span className={cn(base, 'text-muted-foreground')}>
      <LoaderCircle
        className="size-3.5 animate-spin motion-reduce:animate-none"
        aria-hidden
      />
      {status === 'connecting' ? 'Conectando…' : 'Reconectando…'}
    </span>
  );
}
