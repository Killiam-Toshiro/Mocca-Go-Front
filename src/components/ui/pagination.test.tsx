import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './pagination';

describe('Pagination', () => {
  it('muestra «Página X de Y», el rango y deshabilita «Anterior» en la primera', () => {
    render(
      <Pagination
        page={1}
        totalPages={7}
        total={135}
        pageSize={20}
        label="Páginas de usuarios"
        onPageChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('navigation', { name: 'Páginas de usuarios' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 7')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 1–20 de 135')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
  });

  it('avisa la página elegida (anterior, siguiente y número) y marca la actual', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={5} totalPages={20} onPageChange={onPageChange} />);
    expect(screen.getByRole('button', { name: 'Página 5' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(onPageChange).toHaveBeenLastCalledWith(6);
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(onPageChange).toHaveBeenLastCalledWith(4);
    await userEvent.click(screen.getByRole('button', { name: 'Página 20' }));
    expect(onPageChange).toHaveBeenLastCalledWith(20);
    await userEvent.click(screen.getByRole('button', { name: 'Página 1' }));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it('no avisa al elegir la página en la que ya está, y «Siguiente» se deshabilita en la última', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={3} totalPages={3} onPageChange={onPageChange} />);
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Página 3' }));
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('deshabilitado no deja cambiar; con 0 páginas muestra «Página 1 de 1»', () => {
    const { rerender } = render(
      <Pagination page={2} totalPages={5} disabled onPageChange={vi.fn()} />,
    );
    for (const button of screen.getAllByRole('button'))
      expect(button).toBeDisabled();
    rerender(<Pagination page={1} totalPages={0} onPageChange={vi.fn()} />);
    expect(screen.getByText('Página 1 de 1')).toBeInTheDocument();
  });

  it('hideWhenSingle oculta el paginador con una sola página', () => {
    const { container } = render(
      <Pagination
        page={1}
        totalPages={1}
        hideWhenSingle
        onPageChange={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('una página fuera de rango se ajusta', () => {
    render(<Pagination page={99} totalPages={4} onPageChange={vi.fn()} />);
    expect(screen.getByText('Página 4 de 4')).toBeInTheDocument();
  });
});
