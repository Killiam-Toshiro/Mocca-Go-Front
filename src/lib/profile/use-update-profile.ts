'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { requestJson } from '@/lib/api/json';
import { describeProfileError, type ProfileError } from './errors';
import { changedFields, samePhone, type ProfileValues } from './schemas';
import type { Profile } from './types';
import { fetchProfile, PROFILE_KEY } from './use-profile';

export interface UpdateProfileHandlers {
  /** `recovered`: se guardó pero la respuesta se perdió; se encontró al consultar. */
  onDone?: (profile: Profile, how: 'sent' | 'recovered') => void;
  onFail?: (error: ProfileError) => void;
}

/**
 * `PATCH /customers/me` con **solo los campos que cambiaron**. Una marca síncrona frena el doble
 * clic; no se reintenta solo y tras un corte de red se consulta el perfil (D-070, DP-09).
 */
export function useUpdateProfile(handlers: UpdateProfileHandlers = {}) {
  const queryClient = useQueryClient();
  const busy = useRef(false);
  const latest = useRef(handlers);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    latest.current = handlers;
  });

  async function run(original: ProfileValues, values: ProfileValues) {
    const changes = changedFields(original, values);
    if (Object.keys(changes).length === 0 || busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const profile = await requestJson<Profile>('/api/customers/me', {
        method: 'PATCH',
        body: changes,
        handleUnauthorized: true,
      });
      queryClient.setQueryData(PROFILE_KEY, profile);
      latest.current.onDone?.(profile, 'sent');
    } catch (error) {
      const described = describeProfileError(error);
      if (described.kind !== 'ambiguous') {
        latest.current.onFail?.(described);
        return;
      }
      try {
        const profile = await queryClient.fetchQuery({
          queryKey: PROFILE_KEY,
          queryFn: fetchProfile,
          staleTime: 0,
        });
        const applied =
          (changes.fullName === undefined ||
            profile.fullName === changes.fullName) &&
          (changes.phone === undefined ||
            samePhone(profile.phone, changes.phone));
        if (applied) latest.current.onDone?.(profile, 'recovered');
        else latest.current.onFail?.(described);
      } catch {
        latest.current.onFail?.(described);
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return { run, pending };
}
