import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InventoryAlertBanner } from './InventoryAlertBanner';
import type { ProductoInventario } from '../../types';

const p = (over: Record<string, unknown>) =>
  ({
    id: 1,
    codigo: 'C',
    nombre: 'N',
    stock: 0,
    stockMinimo: 2,
    estadoStock: 'SIN_STOCK',
    costoUnitario: 1,
    createdAt: '',
    ...over,
  }) as unknown as ProductoInventario;

describe('InventoryAlertBanner', () => {
  it('ignores products without stock control', () => {
    render(<InventoryAlertBanner productos={[p({ controlaStock: false })]} />);
    expect(screen.queryByText('Alertas de stock')).toBeNull();
  });

  it('alerts only for tracked products', () => {
    render(
      <InventoryAlertBanner
        productos={[
          p({ id: 1, nombre: 'Sin control', controlaStock: false }),
          p({ id: 2, nombre: 'Con control', controlaStock: true }),
          p({ id: 3, nombre: 'Legacy', controlaStock: undefined, estadoStock: 'BAJO' }),
        ]}
      />,
    );
    expect(screen.getByText('Hay 2 productos que requieren atención:')).toBeInTheDocument();
    expect(screen.queryByText('Sin control')).toBeNull();
  });
});
