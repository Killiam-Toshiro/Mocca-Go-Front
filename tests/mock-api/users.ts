import { normalizePhone, PHONE_MESSAGE } from './profile.ts';

/** Usuarios del mock con las reglas y los textos del back (incremento 020 de Mocca-Go). */
export type UserRole = 'admin' | 'operador' | 'repartidor' | 'cliente';
export const STAFF_ROLES = ['admin', 'operador', 'repartidor'] as const;
type StaffRole = (typeof STAFF_ROLES)[number];
const ALL_ROLES: readonly string[] = [...STAFF_ROLES, 'cliente'];

export interface StaffRecord {
  id: string;
  username: string;
  role: StaffRole;
  password: string;
  fullName: string | null;
  phone: string | null;
  expiresIn: number;
  hasHistory: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UsersCustomer {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
  password: string;
}

export interface UsersResult {
  status: number;
  body?: unknown;
}

const err = (status: number, message: string | string[]): UsersResult => ({
  status,
  body: { statusCode: status, message, error: 'Error' },
});

const USERNAME = /^[a-z0-9][a-z0-9._-]{2,63}$/;
export const NOT_FOUND = 'Usuario no encontrado.';
export const USERNAME_TAKEN = 'El username ya existe.';
export const COURIER_CONTACT =
  'Un repartidor necesita teléfono y nombre de contacto (phone y fullName).';
export const CUSTOMER_USERNAME =
  'El username de un cliente es interno y no se edita; el cliente entra con su correo.';
export const STAFF_NAME = 'El nombre del personal admite de 2 a 80 caracteres.';
export const HAS_HISTORY =
  'El usuario tiene historial asociado; no se puede eliminar.';
export const LAST_ADMIN_DELETE =
  'No se puede eliminar al último administrador.';
export const OWN_DELETE = 'No puedes eliminar tu propio usuario.';
export const LAST_ADMIN_DEMOTE =
  'No se puede degradar al último administrador.';
export const OWN_ROLE = 'No puedes cambiar tu propio rol.';
export const CLIENT_ROLE = 'Un cliente no cambia de rol.';
export const AT_LEAST_ONE = 'Indica al menos un campo para editar.';

const text = (v: unknown): v is string => typeof v === 'string';
const NUL = '\u0000';

function seedStaff(): StaffRecord[] {
  const at = '2026-11-01T12:00:00.000Z';
  const base = (
    id: string,
    username: string,
    role: StaffRole,
    extra: Partial<StaffRecord> = {},
  ): StaffRecord => ({
    id,
    username,
    role,
    password: 'Password-123456',
    fullName: null,
    phone: null,
    expiresIn: 900,
    hasHistory: false,
    createdAt: at,
    updatedAt: at,
    ...extra,
  });
  return [
    base('u-admin', 'admin', 'admin'),
    base('u-operador', 'operador', 'operador'),
    base('u-repartidor', 'repartidor', 'repartidor', {
      fullName: 'Carlos Gómez',
      phone: '+573001234500',
    }),
    base('u-repartidor-2', 'repartidor2', 'repartidor', {
      fullName: 'Laura Ríos',
      phone: '+573001234501',
    }),
    base('u-corta', 'corta', 'operador', { expiresIn: 3 }),
    base('u-veterano', 'veterano', 'operador', {
      fullName: 'Operador Veterano',
      phone: '+573001234599',
      hasHistory: true,
    }),
  ];
}

export function createUserStore(
  customers: () => UsersCustomer[],
  internalUsername: (email: string) => string,
  revokeAll: (userId: string) => void,
  password: string,
) {
  let staff: StaffRecord[] = [];
  let counter = 0;
  const reset = () => {
    staff = seedStaff().map((u) => ({ ...u, password }));
    counter = 0;
  };
  reset();

  const staffView = (u: StaffRecord) => ({
    id: u.id,
    username: u.username,
    role: u.role,
    email: null,
    fullName: u.fullName,
    phone: u.phone,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  });
  const customerView = (c: UsersCustomer) => ({
    id: c.id,
    username: internalUsername(c.email),
    role: 'cliente' as const,
    email: c.email,
    fullName: c.fullName,
    phone: c.phone,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  });
  const rows = () => [
    ...staff.map((u) => ({ view: staffView(u), digits: u.phone })),
    ...customers().map((c) => ({ view: customerView(c), digits: c.phone })),
  ];
  const touch = (r: { updatedAt: string }) => {
    r.updatedAt = new Date().toISOString();
  };

  /** Personal por id (también lo usa el login). */
  const findStaff = (id: string) => staff.find((u) => u.id === id);
  const findCustomer = (id: string) => customers().find((c) => c.id === id);
  const adminCount = () => staff.filter((u) => u.role === 'admin').length;

  function list(params: URLSearchParams): UsersResult {
    const num = (key: string, fallback: number) => {
      const raw = params.get(key);
      return raw === null || raw === '' ? fallback : Number(raw);
    };
    const page = Math.max(1, Math.trunc(num('page', 1)) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Math.trunc(num('limit', 20)) || 20),
    );

    let roles: string[] | null = null;
    if (params.has('role')) {
      const parts = (params.get('role') ?? '').split(',').map((p) => p.trim());
      if (parts.some((p) => !ALL_ROLES.includes(p)))
        return err(400, [
          'role debe ser uno o varios de admin, operador, repartidor, cliente separados por coma',
        ]);
      roles = [...new Set(parts)];
    }
    let search = '';
    if (params.has('search')) {
      search = (params.get('search') ?? '').trim();
      if (search.length > 100)
        return err(400, ['search no puede superar los 100 caracteres']);
      if (search.includes(NUL))
        return err(400, ['search contiene caracteres no permitidos']);
    }

    const needle = search.toLowerCase();
    const needleDigits = search.replace(/\D/g, '');
    const matches = rows()
      .filter(({ view }) => !roles || roles.includes(view.role))
      .filter(({ view, digits }) => {
        if (!needle) return true;
        const fields = [view.username, view.fullName, view.phone, view.email];
        if (fields.some((f) => f && f.toLowerCase().includes(needle)))
          return true;
        return (
          needleDigits.length >= 3 &&
          (digits ?? '').replace(/\D/g, '').includes(needleDigits)
        );
      })
      .map(({ view }) => view)
      .sort((a, b) =>
        a.username === b.username
          ? a.id < b.id
            ? -1
            : 1
          : a.username < b.username
            ? -1
            : 1,
      );
    const start = (page - 1) * limit;
    return {
      status: 200,
      body: {
        data: matches.slice(start, start + limit),
        page,
        limit,
        total: matches.length,
        totalPages: Math.ceil(matches.length / limit),
      },
    };
  }

  const taken = (username: string, exceptId?: string) =>
    staff.some((u) => u.username === username && u.id !== exceptId) ||
    customers().some(
      (c) => internalUsername(c.email) === username && c.id !== exceptId,
    );

  /** Valida nombre y teléfono; devuelve los valores limpios o los problemas. */
  function contact(
    body: Record<string, unknown>,
    nameMax: number,
    staffName: boolean,
  ): { fullName?: string; phone?: string; problems: string[] } {
    const problems: string[] = [];
    let fullName: string | undefined;
    let phone: string | undefined;
    if (body.fullName !== undefined) {
      const name = text(body.fullName) ? body.fullName.trim() : null;
      if (name === null || name.length < 2 || name.length > 100)
        problems.push('fullName debe tener entre 2 y 100 caracteres');
      else if (name.length > nameMax)
        problems.push(
          staffName
            ? STAFF_NAME
            : 'fullName debe tener entre 2 y 100 caracteres',
        );
      else fullName = name;
    }
    if (body.phone !== undefined) {
      const normalized = text(body.phone) ? normalizePhone(body.phone) : null;
      if (normalized === null) problems.push(PHONE_MESSAGE);
      else phone = normalized;
    }
    return { fullName, phone, problems };
  }

  const pwdProblem = (v: unknown) =>
    !text(v) || v.length < 12 || v.length > 128 || v.includes(NUL)
      ? 'password debe tener entre 12 y 128 caracteres'
      : null;

  function create(input: unknown): UsersResult {
    const body = (
      typeof input === 'object' && input !== null ? input : {}
    ) as Record<string, unknown>;
    const problems: string[] = [];
    if (!text(body.username) || !USERNAME.test(body.username))
      problems.push('username no cumple el formato permitido');
    const pw = pwdProblem(body.password);
    if (pw) problems.push(pw);
    if (!text(body.role) || !STAFF_ROLES.includes(body.role as StaffRole))
      problems.push('role debe ser admin, operador o repartidor');
    const c = contact(body, 80, true);
    problems.push(...c.problems);
    if (
      body.role === 'repartidor' &&
      c.problems.length === 0 &&
      (c.fullName === undefined || c.phone === undefined)
    )
      problems.push(COURIER_CONTACT);
    if (problems.length > 0) return err(400, problems);
    const username = body.username as string;
    if (taken(username)) return err(409, USERNAME_TAKEN);
    counter += 1;
    const now = new Date().toISOString();
    const record: StaffRecord = {
      id: `u-new-${counter}-${username}`,
      username,
      role: body.role as StaffRole,
      password: body.password as string,
      fullName: c.fullName ?? null,
      phone: c.phone ?? null,
      expiresIn: 900,
      hasHistory: false,
      createdAt: now,
      updatedAt: now,
    };
    staff.push(record);
    return { status: 201, body: staffView(record) };
  }

  function update(id: string, input: unknown): UsersResult {
    const body = (
      typeof input === 'object' && input !== null ? input : {}
    ) as Record<string, unknown>;
    const keys = ['username', 'password', 'phone', 'fullName'] as const;
    const given = keys.filter((k) => k in body);
    if (given.some((k) => body[k] === null))
      return err(400, ['Ningún campo admite null']);
    if (given.length === 0) return err(400, AT_LEAST_ONE);
    const member = findStaff(id);
    const customer = member ? undefined : findCustomer(id);
    const problems: string[] = [];
    if (body.username !== undefined && !customer) {
      if (!text(body.username) || !USERNAME.test(body.username))
        problems.push('username no cumple el formato permitido');
    }
    if (body.password !== undefined) {
      const pw = pwdProblem(body.password);
      if (pw) problems.push(pw);
    }
    const c = contact(body, member ? 80 : 100, Boolean(member));
    problems.push(...c.problems);
    if (problems.length > 0) return err(400, problems);
    if (!member && !customer) return err(404, NOT_FOUND);

    if (customer) {
      if (body.username !== undefined) return err(400, CUSTOMER_USERNAME);
      let changed = false;
      if (c.fullName !== undefined && c.fullName !== customer.fullName) {
        customer.fullName = c.fullName;
        changed = true;
      }
      if (c.phone !== undefined && c.phone !== customer.phone) {
        customer.phone = c.phone;
        changed = true;
      }
      if (typeof body.password === 'string') {
        customer.password = body.password;
        revokeAll(customer.id);
        changed = true;
      }
      if (changed) touch(customer);
      return { status: 200, body: customerView(customer) };
    }
    const user = member as StaffRecord;
    if (body.username !== undefined && body.username !== user.username) {
      if (taken(body.username as string, user.id))
        return err(409, USERNAME_TAKEN);
    }
    let changed = false;
    if (body.username !== undefined && body.username !== user.username) {
      user.username = body.username as string;
      changed = true;
    }
    if (c.fullName !== undefined && c.fullName !== user.fullName) {
      user.fullName = c.fullName;
      changed = true;
    }
    if (c.phone !== undefined && c.phone !== user.phone) {
      user.phone = c.phone;
      changed = true;
    }
    if (typeof body.password === 'string') {
      user.password = body.password;
      revokeAll(user.id);
      changed = true;
    }
    if (changed) touch(user);
    return { status: 200, body: staffView(user) };
  }

  function changeRole(
    id: string,
    actorId: string,
    input: unknown,
  ): UsersResult {
    const body = (
      typeof input === 'object' && input !== null ? input : {}
    ) as Record<string, unknown>;
    if (!text(body.role) || !STAFF_ROLES.includes(body.role as StaffRole))
      return err(400, ['role debe ser admin, operador o repartidor']);
    const role = body.role as StaffRole;
    if (findCustomer(id)) return err(409, CLIENT_ROLE);
    const user = findStaff(id);
    if (!user) return err(404, NOT_FOUND);
    if (user.role === role) return { status: 200, body: staffView(user) };
    if (role === 'repartidor' && (!user.fullName || !user.phone))
      return err(400, COURIER_CONTACT);
    if (user.role === 'admin' && adminCount() <= 1)
      return err(409, LAST_ADMIN_DEMOTE);
    if (user.id === actorId) return err(409, OWN_ROLE);
    user.role = role;
    touch(user);
    revokeAll(user.id);
    return { status: 200, body: staffView(user) };
  }

  function remove(id: string, actorId: string): UsersResult {
    const user = findStaff(id);
    const customer = user ? undefined : findCustomer(id);
    if (!user && !customer) return err(404, NOT_FOUND);
    if (user?.role === 'admin' && adminCount() <= 1)
      return err(409, LAST_ADMIN_DELETE);
    if (id === actorId) return err(409, OWN_DELETE);
    if (user?.hasHistory || customer) return err(409, HAS_HISTORY);
    staff = staff.filter((u) => u.id !== id);
    revokeAll(id);
    return { status: 204 };
  }

  return {
    list,
    create,
    update,
    changeRole,
    remove,
    reset,
    staff: () => staff,
    findStaff,
    /** Contacto de un repartidor para el despacho. */
    contactOf(id: string) {
      const user = findStaff(id);
      return user ? { fullName: user.fullName, phone: user.phone } : undefined;
    },
    setContact(
      id: string,
      change: { fullName: string | null; phone: string | null },
    ) {
      const user = findStaff(id);
      if (user) Object.assign(user, change);
    },
    restoreContact(id: string) {
      const seed = seedStaff().find((u) => u.id === id);
      const user = findStaff(id);
      if (seed && user)
        Object.assign(user, { fullName: seed.fullName, phone: seed.phone });
    },
    markHistory(id: string, value = true) {
      const user = findStaff(id);
      if (user) user.hasHistory = value;
    },
  };
}
