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
  it('does not render when every product is OK', () => {
    render(<InventoryAlertBanner productos={[p({ estadoStock: 'OK', stock: 9 })]} />);
    expect(screen.queryByText('Alertas de stock')).toBeNull();
  });

  it('alerts for every product with low or no stock', () => {
    render(
      <InventoryAlertBanner
        productos={[
          p({ id: 1, nombre: 'Sin stock' }),
          p({ id: 2, nombre: 'Bajo', estadoStock: 'BAJO', stock: 1 }),
          p({ id: 3, nombre: 'Bien', estadoStock: 'OK', stock: 9 }),
        ]}
      />,
    );
    expect(screen.getByText('Hay 2 productos que requieren atención:')).toBeInTheDocument();
    expect(screen.queryByText('Bien')).toBeNull();
  });
});
