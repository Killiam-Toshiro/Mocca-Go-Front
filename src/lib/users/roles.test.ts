import { describe, expect, it } from 'vitest';
import { ROLE_FILTERS, roleLabel, roleParam } from './roles';

describe('roles', () => {
  it('«Personal» envía los tres roles del personal en una sola consulta', () => {
    expect(roleParam('personal')).toBe('admin,operador,repartidor');
  });
  it('«Todos» no envía role; el resto envía su rol', () => {
    expect(roleParam('todos')).toBeNull();
    expect(roleParam('cliente')).toBe('cliente');
    expect(roleParam('repartidor')).toBe('repartidor');
  });
  it('«Personal» es la primera opción y todas tienen texto', () => {
    expect(ROLE_FILTERS[0]).toEqual({ value: 'personal', label: 'Personal' });
    expect(roleLabel('admin')).toBe('Administrador');
  });
});
