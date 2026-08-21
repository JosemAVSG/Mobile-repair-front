import { useState, useEffect } from 'react';
import { Card } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';
import { Icon } from '../atoms/Icon';
import type { ProductoInventario } from '../../types';
import {
  ESTADO_STOCK_LABELS,
  ESTADO_STOCK_VARIANTS,
} from '../../utils/formatters';

interface InventoryAlertBannerProps {
  productos: ProductoInventario[];
}

const STORAGE_KEY = 'inventory-alert-dismissed';
const MAX_VISIBLE = 5;

export function InventoryAlertBanner({ productos }: InventoryAlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Persiste el cierre del banner durante la sesión del navegador.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw === 'true') setDismissed(true);
    } catch {
      // Ignora errores de sessionStorage.
    }
  }, []);

  const alertas = productos.filter(
    (p) => p.estado === 'BAJO' || p.estado === 'SIN_STOCK',
  );

  if (alertas.length === 0 || dismissed) return null;

  const visible = alertas.slice(0, MAX_VISIBLE);
  const restantes = alertas.length - visible.length;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Ignora errores de sessionStorage.
    }
  };

  return (
    <Card className="border-amber-300 bg-amber-50">
      <div className="flex items-start gap-3">
        <Icon name="alert-circle" size={20} className="mt-0.5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-amber-900">
              Alertas de stock
            </h3>
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              Cerrar
            </Button>
          </div>
          <p className="mt-1 text-sm text-amber-800">
            {alertas.length === 1
              ? 'Hay 1 producto que requiere atención:'
              : `Hay ${alertas.length} productos que requieren atención:`}
          </p>
          <ul className="mt-2 space-y-1.5">
            {visible.map((producto) => (
              <li
                key={producto.id}
                className="flex flex-wrap items-center gap-2 text-sm text-amber-900"
              >
                <span className="font-medium">{producto.nombre}</span>
                <span className="text-amber-700">({producto.codigo})</span>
                <Badge variant={ESTADO_STOCK_VARIANTS[producto.estado]}>
                  {ESTADO_STOCK_LABELS[producto.estado]}
                </Badge>
                <span className="text-amber-700">
                  Stock: {producto.stock} / Mín: {producto.stockMinimo}
                </span>
              </li>
            ))}
          </ul>
          {restantes > 0 && (
            <p className="mt-2 text-sm text-amber-700">
              Y {restantes} producto{restantes === 1 ? '' : 's'} más.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
