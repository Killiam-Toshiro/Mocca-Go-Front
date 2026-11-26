import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Escribe tu usuario o correo.'),
  // La longitud la valida el back; aquí solo se exige que no esté vacía.
  password: z.string().min(1, 'Escribe tu contraseña.'),
});
export type LoginValues = z.infer<typeof loginSchema>;

/** Un `@` indica correo (clientes); si no, usuario (personal). El back exige exactamente uno de los dos. */
export function toLoginBody(
  values: LoginValues,
):
  { email: string; password: string } | { username: string; password: string } {
  const identifier = values.identifier.trim();
  return identifier.includes('@')
    ? { email: identifier, password: values.password }
    : { username: identifier.toLowerCase(), password: values.password };
}

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Escribe tu correo.')
    .max(254, 'El correo es demasiado largo.')
    .pipe(z.email('Escribe un correo válido.')),
  password: z
    .string()
    .min(12, 'La contraseña debe tener al menos 12 caracteres.')
    .max(128, 'La contraseña no puede superar los 128 caracteres.'),
  fullName: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(100, 'El nombre no puede superar los 100 caracteres.'),
  // La validación real es del back (celular colombiano o internacional); aquí solo una forma razonable.
  phone: z
    .string()
    .trim()
    .min(1, 'Escribe tu celular.')
    .regex(/^\+?[\d\s()-]{7,20}$/, 'Escribe un número de celular válido.'),
});
export type RegisterValues = z.infer<typeof registerSchema>;
