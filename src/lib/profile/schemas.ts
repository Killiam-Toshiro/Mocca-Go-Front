import { z } from 'zod';
import { registerSchema } from '@/lib/auth/schemas';

/** Nombre y celular con las mismas reglas del registro (la validación real es del back). */
export const profileSchema = z.object({
  fullName: registerSchema.shape.fullName,
  phone: registerSchema.shape.phone,
});
export type ProfileValues = z.infer<typeof profileSchema>;

/** Solo los campos que cambiaron: el back rechaza un `PATCH` vacío y no admite `null`. */
export function changedFields(
  original: ProfileValues,
  values: ProfileValues,
): Partial<ProfileValues> {
  const changes: Partial<ProfileValues> = {};
  const name = values.fullName.trim();
  const phone = values.phone.trim();
  if (name !== original.fullName.trim()) changes.fullName = name;
  if (phone !== original.phone.trim()) changes.phone = phone;
  return changes;
}

export const passwordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'Escribe tu contraseña actual.')
      .min(12, 'La contraseña actual tiene al menos 12 caracteres.')
      .max(128, 'La contraseña no puede superar los 128 caracteres.'),
    newPassword: z
      .string()
      .min(12, 'La contraseña nueva debe tener al menos 12 caracteres.')
      .max(128, 'La contraseña no puede superar los 128 caracteres.'),
    repeat: z.string().min(1, 'Repite la contraseña nueva.'),
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'La contraseña nueva debe ser distinta de la actual.',
  })
  .refine((v) => v.repeat === v.newPassword, {
    path: ['repeat'],
    message: 'Las contraseñas no coinciden.',
  });
export type PasswordValues = z.infer<typeof passwordSchema>;

/** Para decidir si un cambio de celular ya quedó guardado (E.164 contra lo que escribió la persona). */
export function samePhone(a: string, b: string): boolean {
  const da = a.replace(/\D/g, '');
  const db = b.replace(/\D/g, '');
  return (
    da !== '' && db !== '' && (da === db || da.endsWith(db) || db.endsWith(da))
  );
}
