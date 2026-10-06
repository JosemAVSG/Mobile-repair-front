import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderTimeline } from './OrderTimeline';
import { humanizarHistorial, tipoEventoHistorial } from '../../utils/historial';

describe('humanizarHistorial', () => {
  it('traduce códigos de estado a su etiqueta', () => {
    expect(humanizarHistorial('Estado cambiado a: ESPERANDO_ENTREGA')).toBe(
      'Estado cambiado a: Lista para Retiro',
    );
    expect(humanizarHistorial('Estado cambiado a: REPARACION')).toBe(
      'Estado cambiado a: En Reparación',
    );
    expect(humanizarHistorial('Estado cambiado a: REPARACION_COMPLETADA')).toBe(
      'Estado cambiado a: Reparación Completada',
    );
  });

  it('deja intactos mensajes desconocidos y de repuestos', () => {
    expect(humanizarHistorial('Orden creada')).toBe('Orden creada');
    expect(humanizarHistorial('Estado cambiado a: OTRO_X')).toBe('Estado cambiado a: OTRO_X');
    const m = 'Repuesto agregado: Pantalla A54 — $120.000';
    expect(humanizarHistorial(m)).toBe(m);
  });
});

describe('tipoEventoHistorial', () => {
  it('clasifica repuestos agregados/quitados', () => {
    expect(tipoEventoHistorial('Repuesto agregado: X — $1')).toBe('repuesto-add');
    expect(tipoEventoHistorial('Repuesto quitado: X — $1')).toBe('repuesto-remove');
    expect(tipoEventoHistorial('Estado cambiado a: PAGADO')).toBe('status');
  });
});

describe('OrderTimeline', () => {
  it('renderiza el texto completo de repuestos', () => {
    render(
      <OrderTimeline
        events={[
          { date: '2026-01-01T10:00:00', content: 'Repuesto quitado: Pantalla — $120.000', type: 'repuesto-remove' },
        ]}
      />,
    );
    expect(screen.getByText('Repuesto quitado: Pantalla — $120.000')).toBeInTheDocument();
  });
});
