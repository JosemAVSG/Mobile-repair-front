import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RepuestosPage } from './RepuestosPage';
import { createRepuesto, updateRepuesto } from '../api/repuestos';

vi.mock('../api/repuestos', () => ({
  createRepuesto: vi.fn(),
  updateRepuesto: vi.fn().mockResolvedValue({}),
  deleteRepuesto: vi.fn(),
}));
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('../hooks/useQueries', () => ({
  useRepuestos: () => ({
    data: [
      {
        id: 1,
        nombre: 'Batería',
        descripcion: null,
        codigo: 'BAT-1',
        precioCosto: 10,
        precioVenta: null,
        marcaId: 1,
        modeloId: 10,
        tipoReparacion: 'BATERIA',
        createdAt: '',
      },
    ],
    isPending: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
  useMarcas: () => ({ data: [{ id: 1, nombre: 'Apple' }] }),
  useModelos: () => ({
    data: [
      { id: 10, nombre: 'iPhone 13', marcaId: 1 },
      { id: 11, nombre: 'iPhone 14', marcaId: 1 },
    ],
  }),
}));

describe('RepuestosPage modelos compatibles', () => {
  beforeEach(() => vi.clearAllMocks());

  const edit = async (act?: () => void) => {
    render(<RepuestosPage />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    expect(await screen.findByText('Apple iPhone 13')).toBeInTheDocument();
    act?.();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(updateRepuesto).toHaveBeenCalled());
    return vi.mocked(updateRepuesto).mock.calls[0];
  };

  it('sends modeloIds (legacy fallback + added) when updating', async () => {
    const [id, body] = await edit(() =>
      fireEvent.change(screen.getByLabelText('Agregar modelo compatible'), {
        target: { value: '11' },
      }),
    );
    expect(id).toBe(1);
    expect(body.modeloIds).toEqual([10, 11]);
    expect(body.modeloId).toBe(10);
  });

  it('omits modeloIds/modeloId and uso when the selection is untouched', async () => {
    const [, body] = await edit();
    expect('modeloIds' in body).toBe(false);
    expect('modeloId' in body).toBe(false);
    expect('uso' in body).toBe(false);
  });

  it('sends [] and no modeloId when all chips are cleared', async () => {
    const [, body] = await edit(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Quitar Apple iPhone 13' })),
    );
    expect(body.modeloIds).toEqual([]);
    expect(body.modeloId).toBeUndefined();
  });

  it('sends the reduced list when a chip is removed', async () => {
    const [, body] = await edit(() => {
      fireEvent.change(screen.getByLabelText('Agregar modelo compatible'), {
        target: { value: '11' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Quitar Apple iPhone 13' }));
    });
    expect(body.modeloIds).toEqual([11]);
    expect(body.modeloId).toBe(11);
  });

  it('sends the chosen models on create and never sends uso', async () => {
    render(<RepuestosPage />);
    fireEvent.click(screen.getByRole('button', { name: /nuevo repuesto/i }));
    fireEvent.change(screen.getByLabelText('Agregar modelo compatible'), {
      target: { value: '11' },
    });
    const dialog = screen.getByRole('dialog');
    const inputs = dialog.querySelectorAll('input');
    fireEvent.change(inputs[0], { target: { value: 'Pantalla' } });
    fireEvent.change(inputs[1], { target: { value: 'PAN-1' } });
    fireEvent.change(inputs[2], { target: { value: '30' } });
    fireEvent.change(dialog.querySelector('select[aria-label*="ipo"], select') as HTMLElement, {
      target: { value: 'BATERIA' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(createRepuesto).toHaveBeenCalled());
    const body = vi.mocked(createRepuesto).mock.calls[0][0];
    expect(body.modeloIds).toEqual([11]);
    expect(body.modeloId).toBe(11);
    expect('uso' in body).toBe(false);
  });
});
