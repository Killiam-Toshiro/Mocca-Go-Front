import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema, toLoginBody } from './schemas';

describe('toLoginBody', () => {
  it('con @ envía email, sin cambiar mayúsculas del correo', () => {
    expect(
      toLoginBody({ identifier: '  Ana@Example.com ', password: 'x' }),
    ).toEqual({
      email: 'Ana@Example.com',
      password: 'x',
    });
  });

  it('sin @ envía username en minúsculas y sin espacios', () => {
    expect(toLoginBody({ identifier: ' Operador ', password: 'x' })).toEqual({
      username: 'operador',
      password: 'x',
    });
  });

  it('nunca envía los dos a la vez', () => {
    const body = toLoginBody({ identifier: 'a@b.co', password: 'x' });
    expect('username' in body).toBe(false);
  });
});

describe('loginSchema', () => {
  it('exige los dos campos', () => {
    const result = loginSchema.safeParse({ identifier: '  ', password: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toEqual([
      'Escribe tu usuario o correo.',
      'Escribe tu contraseña.',
    ]);
  });
});

describe('registerSchema', () => {
  const valid = {
    email: 'ana@example.com',
    password: 'Password-123456',
    fullName: 'Ana Pérez',
    phone: '3001234567',
  };
  const messages = (input: object) =>
    registerSchema
      .safeParse({ ...valid, ...input })
      .error?.issues.map((i) => i.message) ?? [];

  it('acepta datos válidos y recorta espacios', () => {
    const result = registerSchema.safeParse({
      ...valid,
      email: ' ana@example.com ',
      fullName: ' Ana Pérez ',
    });
    expect(result.data).toMatchObject({
      email: 'ana@example.com',
      fullName: 'Ana Pérez',
    });
  });

  it('correo', () => {
    expect(messages({ email: '' })).toEqual(['Escribe tu correo.']);
    expect(messages({ email: 'sin-arroba' })).toEqual([
      'Escribe un correo válido.',
    ]);
    expect(messages({ email: `${'a'.repeat(250)}@x.co` })).toEqual([
      'El correo es demasiado largo.',
    ]);
  });

  it('contraseña de 12 a 128', () => {
    expect(messages({ password: 'a'.repeat(11) })).toEqual([
      'La contraseña debe tener al menos 12 caracteres.',
    ]);
    expect(messages({ password: 'a'.repeat(12) })).toEqual([]);
    expect(messages({ password: 'a'.repeat(128) })).toEqual([]);
    expect(messages({ password: 'a'.repeat(129) })).toEqual([
      'La contraseña no puede superar los 128 caracteres.',
    ]);
  });

  it('nombre de 2 a 100', () => {
    expect(messages({ fullName: 'A' })).toEqual([
      'El nombre debe tener al menos 2 caracteres.',
    ]);
    expect(messages({ fullName: 'A'.repeat(101) })).toEqual([
      'El nombre no puede superar los 100 caracteres.',
    ]);
  });

  it('teléfono: no vacío y de forma razonable', () => {
    // Vacío incumple dos reglas; el formulario muestra la primera.
    expect(messages({ phone: '' })[0]).toBe('Escribe tu celular.');
    expect(messages({ phone: 'abc' })).toEqual([
      'Escribe un número de celular válido.',
    ]);
    expect(messages({ phone: '+57 300 123 4567' })).toEqual([]);
    expect(messages({ phone: '(300) 123-4567' })).toEqual([]);
  });
});
