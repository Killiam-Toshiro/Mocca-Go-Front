/** Perfil del cliente y cambio de contraseña del mock, con las reglas y textos del back real. */
export interface ProfileCustomer {
  id: string;
  email: string;
  password: string;
  fullName: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileResult {
  status: number;
  body?: unknown;
}

const err = (status: number, message: string | string[]): ProfileResult => ({
  status,
  body: { statusCode: status, message, error: 'Error' },
});

export const PHONE_MESSAGE =
  'phone debe ser un celular colombiano o un número internacional válido.';

/** Celular colombiano (10 dígitos, empieza en 3) o internacional (`+…`) a E.164; si no, `null`. */
export function normalizePhone(value: string): string | null {
  const raw = value.trim();
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+'))
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10 && digits.startsWith('3')) return `+57${digits}`;
  if (digits.length === 12 && digits.startsWith('57') && digits[2] === '3')
    return `+${digits}`;
  return null;
}

const NO_NUL = (value: string) => !value.includes('\u0000');

export function createProfileStore(
  customers: () => ProfileCustomer[],
  revokeOthers: (userId: string, keepToken: string) => void,
) {
  /** Fallos de contraseña actual por usuario y bloqueo (15 min tras 5). */
  const failures = new Map<string, number>();
  const blocked = new Map<string, number>();

  const view = (c: ProfileCustomer) => ({
    id: c.id,
    email: c.email,
    fullName: c.fullName,
    phone: c.phone,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  });

  function get(userId: string): ProfileResult {
    const customer = customers().find((c) => c.id === userId);
    if (!customer) return err(404, 'Cliente no encontrado');
    return { status: 200, body: view(customer) };
  }

  function update(userId: string, input: unknown): ProfileResult {
    const body =
      typeof input === 'object' && input !== null
        ? (input as Record<string, unknown>)
        : {};
    const problems: string[] = [];
    let fullName: string | undefined;
    let phone: string | undefined;
    if (body.fullName !== undefined) {
      const name =
        typeof body.fullName === 'string' ? body.fullName.trim() : null;
      if (name === null || name.length < 2 || name.length > 100)
        problems.push('fullName debe tener entre 2 y 100 caracteres');
      else fullName = name;
    }
    if (body.phone !== undefined) {
      const normalized =
        typeof body.phone === 'string' ? normalizePhone(body.phone) : null;
      if (normalized === null) problems.push(PHONE_MESSAGE);
      else phone = normalized;
    }
    if (problems.length > 0) return err(400, problems);
    if (fullName === undefined && phone === undefined)
      return err(400, 'Indica al menos un campo para editar.');
    const customer = customers().find((c) => c.id === userId);
    if (!customer) return err(404, 'Cliente no encontrado');
    let changed = false;
    if (fullName !== undefined && fullName !== customer.fullName) {
      customer.fullName = fullName;
      changed = true;
    }
    if (phone !== undefined && phone !== customer.phone) {
      customer.phone = phone;
      changed = true;
    }
    if (changed) customer.updatedAt = new Date().toISOString();
    return { status: 200, body: view(customer) };
  }

  /** `PATCH /auth/password` para un cliente. Respuesta 204 sin cuerpo. */
  function changePassword(
    userId: string,
    token: string,
    input: unknown,
  ): ProfileResult {
    const body =
      typeof input === 'object' && input !== null
        ? (input as Record<string, unknown>)
        : {};
    const { currentPassword, newPassword } = body;
    const problems: string[] = [];
    for (const [name, value] of [
      ['currentPassword', currentPassword],
      ['newPassword', newPassword],
    ] as const) {
      if (
        typeof value !== 'string' ||
        value.length < 12 ||
        value.length > 128 ||
        !NO_NUL(value)
      )
        problems.push(`${name} debe tener entre 12 y 128 caracteres`);
    }
    if (problems.length > 0) return err(400, problems);
    const customer = customers().find((c) => c.id === userId);
    if (!customer) return err(401, 'Credenciales inválidas.');
    const now = Date.now();
    if ((blocked.get(userId) ?? 0) > now)
      return err(403, 'La contraseña actual no es correcta.');
    if (customer.password !== currentPassword) {
      const count = (failures.get(userId) ?? 0) + 1;
      failures.set(userId, count);
      if (count >= 5) blocked.set(userId, now + 900_000);
      return err(403, 'La contraseña actual no es correcta.');
    }
    failures.delete(userId);
    blocked.delete(userId);
    if (newPassword === customer.password)
      return err(400, 'La contraseña nueva debe ser distinta de la actual.');
    customer.password = newPassword as string;
    revokeOthers(userId, token);
    return { status: 204 };
  }

  function reset(): void {
    failures.clear();
    blocked.clear();
  }

  return { get, update, changePassword, reset };
}
