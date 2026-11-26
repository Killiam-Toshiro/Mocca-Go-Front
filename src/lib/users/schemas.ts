import { z } from 'zod';
import { samePhone } from '@/lib/profile/schemas';
import { STAFF_ROLES } from './roles';
import type { StaffRole, User } from './types';

/** Mismo patrón que el back; el mensaje del back sigue siendo la autoridad. */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,63}$/;
export const STAFF_NAME_MAX = 80;
export const CUSTOMER_NAME_MAX = 100;
const PHONE_PATTERN = /^\+?[\d\s()-]{7,20}$/;

export const USERNAME_MESSAGE =
  'Usa 3 a 64 caracteres: minúsculas, números, punto, guion o guion bajo, empezando por letra o número.';
const PHONE_MESSAGE = 'Escribe un número de celular válido.';
const nameMessage = (max: number) =>
  `El nombre debe tener entre 2 y ${max} caracteres.`;
const PASSWORD_MESSAGE = 'La contraseña debe tener entre 12 y 128 caracteres.';

export const passwordField = z
  .string()
  .min(12, PASSWORD_MESSAGE)
  .max(128, PASSWORD_MESSAGE);

export const resetPasswordSchema = z.object({ password: passwordField });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export interface CreateUserValues {
  username: string;
  role: StaffRole;
  fullName: string;
  phone: string;
  password: string;
}

export const createUserSchema = z
  .object({
    username: z.string().trim().regex(USERNAME_PATTERN, USERNAME_MESSAGE),
    role: z.enum(['admin', 'operador', 'repartidor']),
    fullName: z.string().trim(),
    phone: z.string().trim(),
    password: passwordField,
  })
  .superRefine((values, ctx) => {
    const courier = values.role === 'repartidor';
    if (values.fullName === '') {
      if (courier)
        ctx.addIssue({
          code: 'custom',
          path: ['fullName'],
          message: 'Un repartidor necesita su nombre.',
        });
    } else if (
      values.fullName.length < 2 ||
      values.fullName.length > STAFF_NAME_MAX
    )
      ctx.addIssue({
        code: 'custom',
        path: ['fullName'],
        message: nameMessage(STAFF_NAME_MAX),
      });
    if (values.phone === '') {
      if (courier)
        ctx.addIssue({
          code: 'custom',
          path: ['phone'],
          message: 'Un repartidor necesita su celular.',
        });
    } else if (!PHONE_PATTERN.test(values.phone))
      ctx.addIssue({
        code: 'custom',
        path: ['phone'],
        message: PHONE_MESSAGE,
      });
  });

/** Cuerpo de `POST /users`: sin los campos de contacto vacíos. */
export function createBody(values: CreateUserValues) {
  const body: {
    username: string;
    password: string;
    role: StaffRole;
    fullName?: string;
    phone?: string;
  } = {
    username: values.username.trim(),
    password: values.password,
    role: values.role,
  };
  if (values.fullName.trim()) body.fullName = values.fullName.trim();
  if (values.phone.trim()) body.phone = values.phone.trim();
  return body;
}

export interface EditValues {
  username: string;
  fullName: string;
  phone: string;
}

export const editValuesOf = (user: User): EditValues => ({
  username: user.username,
  fullName: user.fullName ?? '',
  phone: user.phone ?? '',
});

export const nameMaxOf = (user: User): number =>
  user.role === 'cliente' ? CUSTOMER_NAME_MAX : STAFF_NAME_MAX;

/**
 * Esquema de edición de un usuario. El back no admite `null`: un dato guardado no se puede vaciar,
 * y uno vacío puede seguir vacío. El usuario de un cliente no se valida (es interno y no se edita).
 */
export function editSchema(user: User) {
  const customer = user.role === 'cliente';
  const max = nameMaxOf(user);
  return z
    .object({
      username: z.string().trim(),
      fullName: z.string().trim(),
      phone: z.string().trim(),
    })
    .superRefine((values, ctx) => {
      if (!customer && !USERNAME_PATTERN.test(values.username))
        ctx.addIssue({
          code: 'custom',
          path: ['username'],
          message: USERNAME_MESSAGE,
        });
      if (values.fullName === '') {
        if (user.fullName)
          ctx.addIssue({
            code: 'custom',
            path: ['fullName'],
            message: 'El nombre no se puede dejar vacío una vez guardado.',
          });
      } else if (values.fullName.length < 2 || values.fullName.length > max)
        ctx.addIssue({
          code: 'custom',
          path: ['fullName'],
          message: nameMessage(max),
        });
      if (values.phone === '') {
        if (user.phone)
          ctx.addIssue({
            code: 'custom',
            path: ['phone'],
            message: 'El celular no se puede dejar vacío una vez guardado.',
          });
      } else if (!PHONE_PATTERN.test(values.phone))
        ctx.addIssue({
          code: 'custom',
          path: ['phone'],
          message: PHONE_MESSAGE,
        });
    });
}

/** Solo lo que cambió (el back rechaza un `PATCH` vacío). Un cliente nunca envía `username`. */
export function changedUserFields(
  user: User,
  values: EditValues,
): Partial<EditValues> {
  const changes: Partial<EditValues> = {};
  const username = values.username.trim();
  const fullName = values.fullName.trim();
  const phone = values.phone.trim();
  if (user.role !== 'cliente' && username !== user.username)
    changes.username = username;
  if (fullName !== '' && fullName !== (user.fullName ?? ''))
    changes.fullName = fullName;
  if (phone !== '' && !(user.phone && samePhone(user.phone, phone)))
    changes.phone = phone;
  return changes;
}

/** Cambiar a repartidor exige nombre y celular ya guardados (el back responde 400 si faltan). */
export function courierContactMissing(user: User, role: StaffRole): boolean {
  return role === 'repartidor' && (!user.fullName || !user.phone);
}

export const isStaffRole = (value: string): value is StaffRole =>
  (STAFF_ROLES as readonly string[]).includes(value);

export interface ChangeRoleValues {
  role: StaffRole;
  fullName: string;
  phone: string;
}

/**
 * Cambio de rol. A repartidor se piden (solo los que faltan) nombre y celular, porque el back los
 * exige ya guardados.
 */
export function changeRoleSchema(user: User) {
  return z
    .object({
      role: z.enum(['admin', 'operador', 'repartidor']),
      fullName: z.string().trim(),
      phone: z.string().trim(),
    })
    .superRefine((values, ctx) => {
      if (!courierContactMissing(user, values.role)) return;
      if (!user.fullName) {
        if (values.fullName === '')
          ctx.addIssue({
            code: 'custom',
            path: ['fullName'],
            message: 'Un repartidor necesita su nombre.',
          });
        else if (
          values.fullName.length < 2 ||
          values.fullName.length > STAFF_NAME_MAX
        )
          ctx.addIssue({
            code: 'custom',
            path: ['fullName'],
            message: nameMessage(STAFF_NAME_MAX),
          });
      }
      if (!user.phone) {
        if (values.phone === '')
          ctx.addIssue({
            code: 'custom',
            path: ['phone'],
            message: 'Un repartidor necesita su celular.',
          });
        else if (!PHONE_PATTERN.test(values.phone))
          ctx.addIssue({
            code: 'custom',
            path: ['phone'],
            message: PHONE_MESSAGE,
          });
      }
    });
}

/** Contacto que falta guardar antes de cambiar a repartidor. */
export function missingContact(user: User, values: ChangeRoleValues) {
  const contact: { fullName?: string; phone?: string } = {};
  if (courierContactMissing(user, values.role)) {
    if (!user.fullName) contact.fullName = values.fullName.trim();
    if (!user.phone) contact.phone = values.phone.trim();
  }
  return contact;
}
