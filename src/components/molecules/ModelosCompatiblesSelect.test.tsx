import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ModelosCompatiblesSelect } from './ModelosCompatiblesSelect';
import type { Marca, Modelo } from '../../types';

const marcas = [
  { id: 1, nombre: 'Apple' },
  { id: 2, nombre: 'Samsung' },
] as Marca[];
const modelos = [
  { id: 10, nombre: 'iPhone 13', marcaId: 1 },
  { id: 11, nombre: 'iPhone 14', marcaId: 1 },
  { id: 20, nombre: 'Galaxy S22', marcaId: 2 },
] as Modelo[];

describe('ModelosCompatiblesSelect', () => {
  it('shows selected models as chips and hides them from the options', () => {
    render(
      <ModelosCompatiblesSelect modelos={modelos} marcas={marcas} value={[10]} onChange={vi.fn()} />,
    );
    expect(screen.getByText('Apple iPhone 13')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'iPhone 13' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'iPhone 14' })).toBeInTheDocument();
  });

  it('adds a model on select', () => {
    const onChange = vi.fn();
    render(
      <ModelosCompatiblesSelect modelos={modelos} marcas={marcas} value={[10]} onChange={onChange} />,
    );
    fireEvent.change(screen.getByLabelText('Agregar modelo compatible'), {
      target: { value: '20' },
    });
    expect(onChange).toHaveBeenCalledWith([10, 20]);
  });

  it('removes a model from its chip', () => {
    const onChange = vi.fn();
    render(
      <ModelosCompatiblesSelect
        modelos={modelos}
        marcas={marcas}
        value={[10, 20]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Apple iPhone 13' }));
    expect(onChange).toHaveBeenCalledWith([20]);
  });

  it('shows empty hint and falls back for unknown ids', () => {
    const { rerender } = render(
      <ModelosCompatiblesSelect modelos={modelos} marcas={marcas} value={[]} onChange={vi.fn()} />,
    );
    expect(screen.getByText('Sin modelos seleccionados')).toBeInTheDocument();
    rerender(
      <ModelosCompatiblesSelect modelos={modelos} marcas={marcas} value={[99]} onChange={vi.fn()} />,
    );
    expect(screen.getByText('Modelo #99')).toBeInTheDocument();
  });
});
