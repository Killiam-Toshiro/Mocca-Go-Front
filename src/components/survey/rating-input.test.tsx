import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { RatingInput, RatingStars } from './rating-input';

function Harness({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState<number | null>(null);
  return (
    <RatingInput
      name="r"
      value={value}
      onChange={setValue}
      disabled={disabled}
    />
  );
}

describe('RatingInput', () => {
  it('ofrece 5 opciones con nombre y texto, y muestra la etiqueta de la elegida', async () => {
    render(<Harness />);
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    expect(
      screen.getByRole('radio', { name: '1 de 5 · Muy mala' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Elige de 1 a 5 estrellas')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('radio', { name: '4 de 5 · Buena' }),
    );
    expect(screen.getByRole('radio', { name: '4 de 5 · Buena' })).toBeChecked();
    expect(screen.getByText('4 de 5 · Buena', { selector: 'p' })).toBeVisible();
  });

  it('se maneja con las flechas del teclado', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('radio', { name: '2 de 5 · Mala' }));
    await userEvent.keyboard('{ArrowRight}');
    expect(
      screen.getByRole('radio', { name: '3 de 5 · Regular' }),
    ).toBeChecked();
  });

  it('deshabilitado no deja elegir', () => {
    render(<Harness disabled />);
    for (const radio of screen.getAllByRole('radio'))
      expect(radio).toBeDisabled();
  });

  it('RatingStars dice la calificación en texto', () => {
    render(<RatingStars value={5} />);
    expect(screen.getByText('5 de 5 · Excelente')).toBeInTheDocument();
  });
});
