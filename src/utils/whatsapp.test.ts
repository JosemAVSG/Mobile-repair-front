import { describe, expect, it } from 'vitest';
import { EstadoOrden } from '../types';
import { buildMensajeEstado, buildWhatsAppLink } from './whatsapp';

describe('buildWhatsAppLink', () => {
  it('normaliza "+57 300 1234567" a wa.me/+573001234567', () => {
    const url = buildWhatsAppLink('+57 300 1234567', 'hola');
    expect(url).toContain('https://wa.me/+573001234567');
    expect(url).toContain(`text=${encodeURIComponent('hola')}`);
  });

  it('conserva el + internacional de "(+57) 300 123-4567"', () => {
    const url = buildWhatsAppLink('(+57) 300 123-4567', 'hola');
    expect(url).toContain('https://wa.me/+573001234567');
  });

  it('no antepone + cuando el número no lo trae ("300.123.4567")', () => {
    const url = buildWhatsAppLink('300.123.4567', 'hola');
    expect(url).toContain('https://wa.me/3001234567');
    expect(url).not.toContain('wa.me/+');
  });

  it('no lanza con cadena vacía y devuelve wa.me sin número', () => {
    const url = buildWhatsAppLink('', 'hola');
    expect(url).toBe(`https://wa.me/?text=${encodeURIComponent('hola')}`);
  });

  it('no lanza con null y devuelve wa.me sin número', () => {
    const url = buildWhatsAppLink(null as unknown as string, 'hola');
    expect(url).toBe(`https://wa.me/?text=${encodeURIComponent('hola')}`);
  });
});

describe('buildMensajeEstado', () => {
  const baseParams = { clienteNombre: 'Ana', nombreTaller: 'Taller Demo' };

  it('devuelve un mensaje no vacío que incluye nombreTaller para cada EstadoOrden', () => {
    for (const estado of Object.values(EstadoOrden)) {
      const mensaje = buildMensajeEstado(estado, baseParams);
      expect(mensaje.length).toBeGreaterThan(0);
      expect(mensaje).toContain(baseParams.nombreTaller);
    }
  });

  it('ESPERANDO_ENTREGA con fechaEntrega usa el texto de cita y menciona la fecha', () => {
    const mensaje = buildMensajeEstado(EstadoOrden.ESPERANDO_ENTREGA, {
      ...baseParams,
      fechaEntrega: '2026-08-20T15:00:00.000Z',
    });
    expect(mensaje).toContain('estará lista para retirar el');
    expect(mensaje).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(mensaje).toContain(baseParams.nombreTaller);
  });

  it('ESPERANDO_ENTREGA sin fechaEntrega dice "listo para retirar"', () => {
    const mensaje = buildMensajeEstado(EstadoOrden.ESPERANDO_ENTREGA, baseParams);
    expect(mensaje).toContain('listo para retirar');
  });

  it('un estado desconocido cae al default sin lanzar', () => {
    const mensaje = buildMensajeEstado(
      'ESTADO_INEXISTENTE' as EstadoOrden,
      baseParams,
    );
    expect(mensaje).toContain('avance de tu reparación');
    expect(mensaje).toContain(baseParams.nombreTaller);
  });
});
