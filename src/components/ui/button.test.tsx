import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('se muestra como botón accesible y no se envía deshabilitado', () => {
    render(<Button disabled>Ingresar</Button>);
    const button = screen.getByRole('button', { name: 'Ingresar' });
    expect(button).toBeDisabled();
  });

  it('con asChild renderiza el elemento hijo en lugar de un botón', () => {
    render(
      <Button asChild>
        <a href="/login">Ir a login</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Ir a login' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
