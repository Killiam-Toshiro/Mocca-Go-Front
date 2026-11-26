import { describe, expect, it } from 'vitest';
import {
  AT_LEAST_ONE,
  CLIENT_ROLE,
  COURIER_CONTACT,
  CUSTOMER_USERNAME,
  HAS_HISTORY,
  LAST_ADMIN_DEMOTE,
  LAST_ADMIN_DELETE,
  NOT_FOUND,
  OWN_DELETE,
  OWN_ROLE,
  STAFF_NAME,
  USERNAME_TAKEN,
  createUserStore,
  type UsersCustomer,
} from './users.ts';

const PASS = 'Password-123456';

function setup() {
  const customers: UsersCustomer[] = [
    {
      id: 'c-1',
      email: 'ana.perez@u.icesi',
      password: PASS,
      fullName: 'Ana Pérez',
      phone: '+573001234567',
      createdAt: '2026-11-03T15:00:00.000Z',
      updatedAt: '2026-11-03T15:00:00.000Z',
    },
    {
      id: 'c-2',
      email: 'lu.ci@u.icesi',
      password: PASS,
      fullName: 'Lucía 100%',
      phone: '+573007654321',
      createdAt: '2026-11-03T15:00:00.000Z',
      updatedAt: '2026-11-03T15:00:00.000Z',
    },
  ];
  const revoked: string[] = [];
  const store = createUserStore(
    () => customers,
    (email) => `internal-${email.split('@')[0]}`,
    (id) => revoked.push(id),
    PASS,
  );
  return { customers, revoked, store };
}
const q = (init: Record<string, string>) => new URLSearchParams(init);
const page = (r: { body?: unknown }) =>
  r.body as {
    data: { username: string; role: string; email: string | null }[];
    total: number;
    totalPages: number;
    page: number;
    limit: number;
  };

describe('mock de usuarios: listado', () => {
  it('sin parámetros lista todos por usuario y trae total y totalPages', () => {
    const { store } = setup();
    const r = page(store.list(q({})));
    expect(r.total).toBe(8);
    expect(r.data.map((u) => u.username)).toEqual(
      [...r.data.map((u) => u.username)].sort(),
    );
    expect(r.totalPages).toBe(1);
    expect(r.limit).toBe(20);
  });

  it('role admite varios valores y no lista clientes en «Personal»', () => {
    const { store } = setup();
    const r = page(store.list(q({ role: 'admin,operador,repartidor' })));
    expect(r.total).toBe(6);
    expect(r.data.every((u) => u.role !== 'cliente')).toBe(true);
    expect(page(store.list(q({ role: 'cliente,cliente' }))).total).toBe(2);
  });

  it.each(['', 'admin,', 'jefe', 'admin,,cliente'])(
    'role inválido «%s» responde 400',
    (role) => {
      expect(setup().store.list(q({ role })).status).toBe(400);
    },
  );

  it('search: parcial, sin mayúsculas, con tildes y por correo de clientes', () => {
    const { store } = setup();
    expect(page(store.list(q({ search: 'ANA.PEREZ' }))).total).toBe(1);
    expect(page(store.list(q({ search: 'Lucía' }))).total).toBe(1);
    expect(page(store.list(q({ search: 'Lucia' }))).total).toBe(0);
    expect(page(store.list(q({ search: 'carlos' }))).data[0]?.username).toBe(
      'repartidor',
    );
    expect(page(store.list(q({ search: '  ' }))).total).toBe(8);
  });

  it('search: %, _ y \\ son literales', () => {
    const { store } = setup();
    expect(page(store.list(q({ search: '100%' }))).total).toBe(1);
    expect(page(store.list(q({ search: '%' }))).total).toBe(1);
    expect(page(store.list(q({ search: '_' }))).total).toBe(0);
  });

  it('search: con 3 o más dígitos compara los dígitos del teléfono', () => {
    const { store } = setup();
    for (const search of ['300 123', '300-123', '+57 300 123'])
      expect(
        page(store.list(q({ search }))).data.map((u) => u.email),
      ).toContain('ana.perez@u.icesi');
    expect(page(store.list(q({ search: '0 1' }))).total).toBe(0);
  });

  it('search demasiado largo o con NUL responde 400', () => {
    const { store } = setup();
    expect(store.list(q({ search: 'a'.repeat(101) })).status).toBe(400);
    expect(store.list(q({ search: 'a\u0000b' })).status).toBe(400);
  });

  it('pagina con limit y totalPages del filtro', () => {
    const { store } = setup();
    const r = page(store.list(q({ limit: '3', page: '2' })));
    expect(r.data).toHaveLength(3);
    expect(r.totalPages).toBe(3);
  });
});

describe('mock de usuarios: crear y editar', () => {
  const NEW = {
    username: 'nuevo.op',
    password: 'clave-generica',
    role: 'operador',
  };

  it('crea personal con 201; repartidor exige nombre y teléfono; 409 repetido', () => {
    const { store } = setup();
    expect(store.create(NEW).status).toBe(201);
    expect(store.create(NEW)).toMatchObject({
      status: 409,
      body: { message: USERNAME_TAKEN },
    });
    expect(
      store.create({ ...NEW, username: 'rep.sin', role: 'repartidor' }),
    ).toMatchObject({ status: 400, body: { message: [COURIER_CONTACT] } });
    const ok = store.create({
      ...NEW,
      username: 'rep.ok',
      role: 'repartidor',
      fullName: 'Rep Ok',
      phone: '311 222 3344',
    });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ phone: '+573112223344', email: null });
  });

  it('edita un cliente: nombre y teléfono sí, usuario no, contraseña revoca', () => {
    const { store, customers, revoked } = setup();
    const r = store.update('c-1', {
      fullName: ' Ana M. ',
      phone: '311 222 3344',
    });
    expect(r.body).toMatchObject({
      fullName: 'Ana M.',
      phone: '+573112223344',
    });
    expect(customers[0]?.fullName).toBe('Ana M.');
    expect(store.update('c-1', { username: 'otro' })).toMatchObject({
      status: 400,
      body: { message: CUSTOMER_USERNAME },
    });
    expect(store.update('c-1', { password: 'otra-clave-123' }).status).toBe(
      200,
    );
    expect(revoked).toEqual(['c-1']);
    expect(customers[0]?.password).toBe('otra-clave-123');
  });

  it('nombre: 80 para el personal y 100 para el cliente', () => {
    const { store } = setup();
    const name = 'N'.repeat(90);
    expect(store.update('u-operador', { fullName: name })).toMatchObject({
      status: 400,
      body: { message: [STAFF_NAME] },
    });
    expect(store.update('c-1', { fullName: name }).status).toBe(200);
  });

  it('no toca updatedAt si nada cambia; exige un campo; 404', () => {
    const { store } = setup();
    const before = (
      store.update('c-1', { fullName: 'Ana Pérez' }).body as {
        updatedAt: string;
      }
    ).updatedAt;
    expect(before).toBe('2026-11-03T15:00:00.000Z');
    expect(store.update('c-1', {})).toMatchObject({
      status: 400,
      body: { message: AT_LEAST_ONE },
    });
    expect(store.update('nadie', { fullName: 'Nadie' })).toMatchObject({
      status: 404,
      body: { message: NOT_FOUND },
    });
  });

  it('personal: usuario repetido 409 y contraseña nueva revoca sesiones', () => {
    const { store, revoked } = setup();
    expect(store.update('u-operador', { username: 'admin' }).status).toBe(409);
    expect(
      store.update('u-operador', { password: 'clave-generica' }).status,
    ).toBe(200);
    expect(revoked).toEqual(['u-operador']);
    expect(store.findStaff('u-operador')?.password).toBe('clave-generica');
  });
});

describe('mock de usuarios: rol y borrado', () => {
  it('cambiar rol revoca sesiones; mismo rol no hace nada', () => {
    const { store, revoked } = setup();
    expect(
      store.changeRole('u-operador', 'u-admin', { role: 'operador' }).status,
    ).toBe(200);
    expect(revoked).toEqual([]);
    expect(
      store.changeRole('u-operador', 'u-admin', { role: 'admin' }).status,
    ).toBe(200);
    expect(revoked).toEqual(['u-operador']);
  });

  it('reglas en orden: cliente, repartidor sin datos, último admin, propio rol', () => {
    const { store } = setup();
    expect(
      store.changeRole('c-1', 'u-admin', { role: 'operador' }),
    ).toMatchObject({
      status: 409,
      body: { message: CLIENT_ROLE },
    });
    expect(
      store.changeRole('u-operador', 'u-admin', { role: 'repartidor' }),
    ).toMatchObject({ status: 400, body: { message: COURIER_CONTACT } });
    expect(
      store.changeRole('u-admin', 'u-admin', { role: 'operador' }),
    ).toMatchObject({
      status: 409,
      body: { message: LAST_ADMIN_DEMOTE },
    });
    store.changeRole('u-operador', 'u-admin', { role: 'admin' });
    expect(
      store.changeRole('u-admin', 'u-admin', { role: 'operador' }),
    ).toMatchObject({
      status: 409,
      body: { message: OWN_ROLE },
    });
    expect(store.changeRole('nadie', 'u-admin', { role: 'admin' }).status).toBe(
      404,
    );
  });

  it('borra sin historial; 409 con historial, a uno mismo y al último admin', () => {
    const { store } = setup();
    const created = store.create({
      username: 'borrable',
      password: 'clave-generica',
      role: 'operador',
    }).body as { id: string };
    expect(store.remove(created.id, 'u-admin').status).toBe(204);
    expect(store.remove(created.id, 'u-admin').status).toBe(404);
    expect(store.remove('u-veterano', 'u-admin')).toMatchObject({
      status: 409,
      body: { message: HAS_HISTORY },
    });
    expect(store.remove('u-admin', 'u-admin')).toMatchObject({
      status: 409,
      body: { message: LAST_ADMIN_DELETE },
    });
    store.changeRole('u-operador', 'u-admin', { role: 'admin' });
    expect(store.remove('u-admin', 'u-admin')).toMatchObject({
      status: 409,
      body: { message: OWN_DELETE },
    });
  });

  it('contacto del repartidor: se puede dejar incompleto y restaurar', () => {
    const { store } = setup();
    store.setContact('u-repartidor', { fullName: null, phone: null });
    expect(store.contactOf('u-repartidor')).toEqual({
      fullName: null,
      phone: null,
    });
    store.restoreContact('u-repartidor');
    expect(store.contactOf('u-repartidor')?.fullName).toBe('Carlos Gómez');
  });
});
