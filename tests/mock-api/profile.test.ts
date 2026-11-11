import { describe, expect, it } from 'vitest';
import {
  createProfileStore,
  normalizePhone,
  type ProfileCustomer,
} from './profile.ts';

const PASS = 'Password-123456';
const NEW = 'Otra-Clave-98765';

function setup() {
  const customers: ProfileCustomer[] = [
    {
      id: 'c-1',
      email: 'a@example.com',
      password: PASS,
      fullName: 'Ana Pérez',
      phone: '+573001234567',
      createdAt: '2026-11-03T15:00:00.000Z',
      updatedAt: '2026-11-03T15:00:00.000Z',
    },
  ];
  const revoked: [string, string][] = [];
  const store = createProfileStore(
    () => customers,
    (id, keep) => revoked.push([id, keep]),
  );
  return { customers, revoked, store };
}

describe('mock del perfil', () => {
  it('normaliza el celular a E.164 o lo rechaza', () => {
    expect(normalizePhone('300 765 4322')).toBe('+573007654322');
    expect(normalizePhone('+57 300 123 4567')).toBe('+573001234567');
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
  });

  it('GET devuelve el perfil con fechas', () => {
    const { store } = setup();
    expect(store.get('c-1').body).toMatchObject({
      email: 'a@example.com',
      createdAt: '2026-11-03T15:00:00.000Z',
    });
    expect(store.get('nadie').status).toBe(404);
  });

  it('PATCH exige un campo, valida y solo toca updatedAt si algo cambia', () => {
    const { store, customers } = setup();
    expect(store.update('c-1', {})).toMatchObject({
      status: 400,
      body: { message: 'Indica al menos un campo para editar.' },
    });
    expect(store.update('c-1', { phone: '123' }).status).toBe(400);
    expect(store.update('c-1', { fullName: 'A' }).status).toBe(400);
    const same = store.update('c-1', { fullName: ' Ana Pérez ' });
    expect(same.status).toBe(200);
    expect(customers[0]?.updatedAt).toBe('2026-11-03T15:00:00.000Z');
    const changed = store.update('c-1', { phone: '300 765 4322' });
    expect(changed.body).toMatchObject({ phone: '+573007654322' });
    expect(customers[0]?.updatedAt).not.toBe('2026-11-03T15:00:00.000Z');
  });

  it('contraseña: 403 si la actual no es correcta, 400 si es igual, 204 y revoca las otras sesiones', () => {
    const { store, customers, revoked } = setup();
    expect(
      store.changePassword('c-1', 't1', {
        currentPassword: 'Incorrecta-12345',
        newPassword: NEW,
      }),
    ).toMatchObject({
      status: 403,
      body: { message: 'La contraseña actual no es correcta.' },
    });
    expect(
      store.changePassword('c-1', 't1', {
        currentPassword: PASS,
        newPassword: PASS,
      }),
    ).toMatchObject({
      status: 400,
      body: { message: 'La contraseña nueva debe ser distinta de la actual.' },
    });
    expect(
      store.changePassword('c-1', 't1', { currentPassword: PASS }).status,
    ).toBe(400);
    expect(
      store.changePassword('c-1', 't1', {
        currentPassword: PASS,
        newPassword: NEW,
      }).status,
    ).toBe(204);
    expect(customers[0]?.password).toBe(NEW);
    expect(revoked).toEqual([['c-1', 't1']]);
  });

  it('cinco fallos bloquean la cuenta: ni la correcta pasa (mismo 403)', () => {
    const { store } = setup();
    for (let i = 0; i < 5; i += 1)
      store.changePassword('c-1', 't1', {
        currentPassword: 'Incorrecta-12345',
        newPassword: NEW,
      });
    const blocked = store.changePassword('c-1', 't1', {
      currentPassword: PASS,
      newPassword: NEW,
    });
    expect(blocked).toMatchObject({
      status: 403,
      body: { message: 'La contraseña actual no es correcta.' },
    });
    store.reset();
    expect(
      store.changePassword('c-1', 't1', {
        currentPassword: PASS,
        newPassword: NEW,
      }).status,
    ).toBe(204);
  });
});
