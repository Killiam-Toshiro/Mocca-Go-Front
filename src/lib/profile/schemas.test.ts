import { describe, expect, it } from 'vitest';
import {
  changedFields,
  passwordSchema,
  profileSchema,
  samePhone,
} from './schemas';

const original = { fullName: 'Ana Pérez', phone: '+573001234567' };

describe('changedFields', () => {
  it('solo devuelve lo que cambió, recortado', () => {
    expect(changedFields(original, original)).toEqual({});
    expect(
      changedFields(original, {
        fullName: ' Ana Pérez ',
        phone: '+573001234567 ',
      }),
    ).toEqual({});
    expect(
      changedFields(original, {
        fullName: 'Ana M. Pérez ',
        phone: original.phone,
      }),
    ).toEqual({ fullName: 'Ana M. Pérez' });
    expect(
      changedFields(original, { fullName: 'Ana Pérez', phone: '300 765 4322' }),
    ).toEqual({ phone: '300 765 4322' });
  });
});

describe('profileSchema', () => {
  it('valida nombre (2–100) y un celular de forma razonable', () => {
    expect(profileSchema.safeParse(original).success).toBe(true);
    expect(
      profileSchema.safeParse({ ...original, fullName: 'A' }).success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({ ...original, fullName: 'x'.repeat(101) })
        .success,
    ).toBe(false);
    expect(profileSchema.safeParse({ ...original, phone: '12' }).success).toBe(
      false,
    );
    expect(profileSchema.safeParse({ ...original, phone: '' }).success).toBe(
      false,
    );
  });
});

describe('passwordSchema', () => {
  const ok = {
    currentPassword: 'Password-123456',
    newPassword: 'Otra-Clave-98765',
    repeat: 'Otra-Clave-98765',
  };
  const messages = (value: unknown) => {
    const r = passwordSchema.safeParse(value);
    return r.success ? [] : r.error.issues.map((i) => i.message);
  };
  it('acepta contraseñas válidas', () => {
    expect(messages(ok)).toEqual([]);
  });
  it('exige 12–128, distinta de la actual y repetida igual', () => {
    expect(
      messages({ ...ok, newPassword: 'corta', repeat: 'corta' }),
    ).toContain('La contraseña nueva debe tener al menos 12 caracteres.');
    expect(
      messages({
        ...ok,
        newPassword: ok.currentPassword,
        repeat: ok.currentPassword,
      }),
    ).toContain('La contraseña nueva debe ser distinta de la actual.');
    expect(messages({ ...ok, repeat: 'Distinta-Clave-1' })).toContain(
      'Las contraseñas no coinciden.',
    );
    expect(messages({ ...ok, currentPassword: '' })).toContain(
      'Escribe tu contraseña actual.',
    );
    expect(
      messages({
        ...ok,
        newPassword: 'x'.repeat(129),
        repeat: 'x'.repeat(129),
      }),
    ).toContain('La contraseña no puede superar los 128 caracteres.');
  });
});

describe('samePhone', () => {
  it('compara el E.164 con lo que escribió la persona', () => {
    expect(samePhone('+573001234567', '300 123 4567')).toBe(true);
    expect(samePhone('+573001234567', '+57 300 123 4567')).toBe(true);
    expect(samePhone('+573001234567', '300 765 4322')).toBe(false);
    expect(samePhone('', '300')).toBe(false);
  });
});
