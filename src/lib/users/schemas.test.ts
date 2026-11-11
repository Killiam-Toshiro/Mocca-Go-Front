import { describe, expect, it } from 'vitest';
import {
  changedUserFields,
  courierContactMissing,
  createBody,
  createUserSchema,
  editSchema,
  editValuesOf,
  resetPasswordSchema,
} from './schemas';
import { GENERIC_PASSWORD } from './generic-password';
import {
  customerFixture,
  staffFixtures,
  userFixture,
} from '../../../tests/utils/users';

const valid = {
  username: 'nuevo.op',
  role: 'operador' as const,
  fullName: '',
  phone: '',
  password: GENERIC_PASSWORD,
};

describe('clave genérica', () => {
  it('cumple la regla del back (12–128)', () => {
    expect(GENERIC_PASSWORD).toBe('clave-generica');
    expect(GENERIC_PASSWORD.length).toBeGreaterThanOrEqual(12);
    expect(
      resetPasswordSchema.safeParse({ password: GENERIC_PASSWORD }).success,
    ).toBe(true);
  });
});

describe('createUserSchema', () => {
  it('acepta personal sin contacto y valida el formato del usuario', () => {
    expect(createUserSchema.safeParse(valid).success).toBe(true);
    for (const username of ['Ab', 'ñandú', '-abc', 'a b c', 'ab'])
      expect(createUserSchema.safeParse({ ...valid, username }).success).toBe(
        false,
      );
  });
  it('un repartidor exige nombre y celular', () => {
    const r = createUserSchema.safeParse({ ...valid, role: 'repartidor' });
    expect(r.success).toBe(false);
    const paths = r.error?.issues.map((i) => i.path[0]);
    expect(paths).toContain('fullName');
    expect(paths).toContain('phone');
    expect(
      createUserSchema.safeParse({
        ...valid,
        role: 'repartidor',
        fullName: 'Rep Ok',
        phone: '311 222 3344',
      }).success,
    ).toBe(true);
  });
  it('nombre de 2 a 80 y contraseña de 12 a 128', () => {
    expect(
      createUserSchema.safeParse({ ...valid, fullName: 'N'.repeat(81) })
        .success,
    ).toBe(false);
    expect(
      createUserSchema.safeParse({ ...valid, fullName: 'A' }).success,
    ).toBe(false);
    expect(
      createUserSchema.safeParse({ ...valid, password: 'corta' }).success,
    ).toBe(false);
    expect(
      createUserSchema.safeParse({ ...valid, password: 'x'.repeat(129) })
        .success,
    ).toBe(false);
  });
  it('el cuerpo omite el contacto vacío y recorta', () => {
    expect(createBody({ ...valid, username: ' nuevo.op ' })).toEqual({
      username: 'nuevo.op',
      password: GENERIC_PASSWORD,
      role: 'operador',
    });
    expect(
      createBody({ ...valid, fullName: ' Ana ', phone: '311' }),
    ).toMatchObject({
      fullName: 'Ana',
      phone: '311',
    });
  });
});

describe('edición', () => {
  const staff = userFixture({ fullName: 'Ana', phone: '+573001234567' });
  const customer = customerFixture();

  it('solo envía lo que cambió (el celular se compara sin formato)', () => {
    expect(changedUserFields(staff, editValuesOf(staff))).toEqual({});
    expect(
      changedUserFields(staff, {
        username: 'otro',
        fullName: ' Ana ',
        phone: '300 123 4567',
      }),
    ).toEqual({ username: 'otro' });
    expect(
      changedUserFields(staff, {
        ...editValuesOf(staff),
        phone: '311 222 3344',
      }),
    ).toEqual({ phone: '311 222 3344' });
  });
  it('un cliente nunca envía el usuario', () => {
    expect(
      changedUserFields(customer, {
        ...editValuesOf(customer),
        username: 'x',
        fullName: 'Ana M.',
      }),
    ).toEqual({ fullName: 'Ana M.' });
  });
  it('nombre: 80 para el personal y 100 para el cliente', () => {
    const name = 'N'.repeat(90);
    expect(
      editSchema(staff).safeParse({ ...editValuesOf(staff), fullName: name })
        .success,
    ).toBe(false);
    expect(
      editSchema(customer).safeParse({
        ...editValuesOf(customer),
        fullName: name,
      }).success,
    ).toBe(true);
    expect(
      editSchema(customer).safeParse({
        ...editValuesOf(customer),
        fullName: 'N'.repeat(101),
      }).success,
    ).toBe(false);
  });
  it('un dato guardado no se puede vaciar; uno vacío puede seguir vacío', () => {
    expect(
      editSchema(staff).safeParse({ ...editValuesOf(staff), fullName: '' })
        .success,
    ).toBe(false);
    const empty = userFixture();
    expect(editSchema(empty).safeParse(editValuesOf(empty)).success).toBe(true);
  });
  it('el usuario de un cliente no se valida; el del personal sí', () => {
    expect(editSchema(customer).safeParse(editValuesOf(customer)).success).toBe(
      true,
    );
    expect(
      editSchema(staff).safeParse({ ...editValuesOf(staff), username: 'AB' })
        .success,
    ).toBe(false);
  });
});

describe('cambio de rol', () => {
  it('a repartidor exige nombre y celular ya guardados', () => {
    const [, rep, op] = staffFixtures();
    expect(courierContactMissing(op!, 'repartidor')).toBe(true);
    expect(courierContactMissing(rep!, 'repartidor')).toBe(false);
    expect(courierContactMissing(op!, 'admin')).toBe(false);
  });
});
