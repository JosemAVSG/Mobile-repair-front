# Flujo de la Aplicación — Sistema de Gestión de Reparaciones

Documentación del flujo completo de la app: cómo se relacionan las entidades, qué recorre
una orden de reparación, cómo la ven el taller y el cliente, y qué módulos existen.

## Arquitectura de dominio

El sistema es **client-centric**: todo gira alrededor del **cliente** y sus **órdenes de trabajo**.
Un cliente puede traer uno o más dispositivos, y cada dispositivo genera su propia orden.

```
Cliente (1) ←→ (N) OrdenTrabajo
```

La orden de trabajo **embebe** la información del equipo que se repara (no existe una entidad
separada de "dispositivo"):

| Campo | Descripción |
|-------|-------------|
| `tipo` | Tipo de equipo: CELULAR, MICROONDAS, NEVERA, COCINA, LAVADORA, COMPUTADORA |
| `marcaId` / `modeloId` | Referencias al catálogo de marcas y modelos |
| `numeroSerie` / `imei` | Identificadores del equipo |
| `capacidad` | Capacidad (ej. almacenamiento del celular) |
| `tipoGas` | Solo línea blanca (ej. tipo de gas del microondas) |
| `voltaje` | Solo línea blanca |
| `notasTecnicas` | Notas del técnico sobre el equipo |

### Campos condicionados por tipo de equipo

Los campos opcionales del equipo **se muestran según el tipo** — un celular no tiene 110V/220V
ni gas, y una cocina no tiene IMEI:

| Tipo | Campos visibles |
|------|-----------------|
| **CELULAR** | IMEI, Número de Serie, Capacidad (GB), Notas Técnicas |
| **COMPUTADORA** | Número de Serie, Capacidad (GB), Notas Técnicas |
| **Línea blanca** (MICROONDAS, NEVERA, COCINA, LAVADORA) | Capacidad (L), Tipo de Gas, Voltaje, Notas Técnicas |

Esta regla de UI **espeja la validación del backend** al crear una orden:
`CELULAR` exige `imei`, línea blanca exige `tipoGas` + `voltaje`, `COMPUTADORA` exige `numeroSerie`.

> **Decisión de diseño (2026-08-25):** se eliminó la entidad `Dispositivo`. Antes el modelo era
> `Cliente → Dispositivo → OrdenTrabajo` con campos duplicados. Ahora la información del equipo
> vive directamente en la orden, simplificando el modelo.

## Roles y permisos

| Rol | Alcance |
|-----|---------|
| **ADMIN** | Acceso total: dashboard, catálogo, clientes, órdenes, tarifas, repuestos, inventario, configuración, técnicos |
| **TECNICO** | Solo órdenes asignadas: ver, editar estado, subir fotos, gestionar reparaciones |

## Ciclo de vida de una orden (12 estados)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   REGISTRO   │ ──► │  DIAGNOSTICO │ ──► │  REPARACION  │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                                          ┌──────▼───────┐     ┌───────────────────┐
                                          │ESPERANDO_    │ ◄─► │ REPARACION_       │
                                          │REPUESTO      │     │ COMPLETADA        │
                                          └──────┬───────┘     └────────┬──────────┘
                                                 │                      │
                                          ┌──────▼──────────────────────▼──────┐
                                          │         CONTROL_CALIDAD          │
                                          └──────┬──────────────────────┬─────┘
                                                 │                      │ (falla → REPARACION)
                                          ┌──────▼──────┐
                                          │ESPERANDO_   │
                                          │ENTREGA      │
                                          └──────┬──────┘
                                                 │
                                    ┌────────────▼────────────┐
                                    │         PAGADO          │
                                    └────────────┬────────────┘
                                                 │
                              ┌──────────────────┼──────────────────┐
                              ▼                  ▼                  ▼
                      ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
                      │  ENTREGADO   │   │   GARANTIA   │   │  DEVUELTO    │
                      └──────────────┘   └──────────────┘   └──────────────┘
```

### Estados especiales

| Estado | Comportamiento |
|--------|----------------|
| `PRESUPUESTO_RECHAZADO` | El cliente rechaza el presupuesto; la orden no sigue el flujo lineal (se muestra como banner en la vista pública) |
| `DEVUELTO` | El equipo se devuelve sin reparar (estado terminal) |
| `GARANTIA` | El equipo vuelve por garantía tras ser entregado (estado terminal) |

### Agrupaciones usadas en el sistema

| Grupo | Estados |
|-------|---------|
| **Terminales** | ENTREGADO, GARANTIA, DEVUELTO |
| **Activas** | Todos excepto terminales |
| **En reparación** | REPARACION, ESPERANDO_REPUESTO, REPARACION_COMPLETADA, CONTROL_CALIDAD |
| **Con ingresos** | PAGADO, ENTREGADO, GARANTIA |

## Etapas fotográficas

Las fotos de una orden se capturan según el estado (no en cualquier momento):

| Etapa | Estados permitidos |
|-------|--------------------|
| **ANTES** | REGISTRO, DIAGNOSTICO, PRESUPUESTO_RECHAZADO |
| **DURANTE** | REPARACION, ESPERANDO_REPUESTO, CONTROL_CALIDAD |
| **DESPUES** | REPARACION_COMPLETADA, CONTROL_CALIDAD, ESPERANDO_ENTREGA, PAGADO, ENTREGADO, GARANTIA |

## Vista pública del cliente (QR)

Cada orden genera un QR que el cliente escanea para seguir su reparación **sin iniciar sesión**.

```
QR → /estado/:id → PublicRepairStatusPage
```

- La ruta pública muestra etapas simplificadas: **Ingresado → En reparación → Listo para retiro → Finalizado**
- Los estados `PRESUPUESTO_RECHAZADO` y `DEVUELTO` se muestran como **banner**, no como etapa lineal
- Compatibilidad: un QR antiguo apuntando a `/reparaciones/:id` redirige a `/estado/:id` si no hay sesión;
  con sesión, muestra el detalle interno

## Rutas de la aplicación

| Ruta | Acceso | Vista |
|------|--------|-------|
| `/login` | Público | Login |
| `/estado/:id` | Público | Estado público de la orden (QR) |
| `/` | ADMIN | Dashboard con KPIs |
| `/marcas`, `/modelos` | ADMIN | Catálogo |
| `/clientes`, `/clientes/:id` | ADMIN | Clientes y detalle con sus órdenes |
| `/reparaciones` | ADMIN + TECNICO | Lista de órdenes |
| `/reparaciones/:id` | ADMIN + TECNICO | Detalle de la orden |
| `/tarifas`, `/repuestos` | ADMIN | Tarifas de reparación y repuestos |
| `/inventario` | ADMIN | Inventario con stock y movimientos |
| `/configuracion` | ADMIN | Nombre/logo del taller |
| `/tecnicos` | ADMIN | Gestión de técnicos |

## Módulos

- **Dashboard**: KPIs de órdenes activas, en reparación, e ingresos
- **Catálogo**: marcas y modelos (celulares, línea blanca, computadoras)
- **Clientes**: CRUD de clientes; el detalle muestra todas sus órdenes con la info del equipo
- **Órdenes**: creación client-centric (se elige cliente + se cargan datos del equipo), transiciones de estado, fotos por etapa, factura
- **Tarifas y repuestos**: precios por marca/modelo/tipo de reparación
- **Inventario**: productos, stock mínimo, estados OK/BAJO/SIN_STOCK, movimientos COMPRA/CONSUMO, KPIs
- **Configuración**: nombre y logo del taller (visible en el header y en la vista pública)

---

## Pendiente — Monetización

El sistema **no tiene aún ningún mecanismo de precios/planes para monetizar**. Está pensado como
la siguiente etapa del producto.

### Qué falta implementar

- **Planes/suscripciones del taller** (módulo "Planes" en Configuración):
  - Definición de planes (mensual, anual, etc.)
  - Límites por plan (número de órdenes, técnicos, dispositivos, etc.)
  - Estado de suscripción activa/vencida
- **Pagos / pasarela**: integración con un proveedor de pagos (Stripe, Mercado Pago, etc.)
- **Facturación recurrente**: cobro automático de la suscripción
- **Licencias** (opción explorada): acceso pago por planes para el taller

### Notas

- El modelo de datos actual **no tiene tablas de planes ni suscripciones** — se debe diseñar
  como un módulo nuevo (siguiendo el patrón hexagonal del backend y el patrón de páginas del frontend).
- Los **precios de reparación** ya existen (módulo Tarifas); lo pendiente es monetizar el **uso del sistema**.
- Cuando se implemente, actualizar este documento con el flujo de suscripción.