# Design: Client-Centric Refactor

## Technical Approach

Collapse the `Cliente → Dispositivo → OrdenTrabajo` three-entity chain into `Cliente → OrdenTrabajo` by embedding four device fields (`capacidad`, `tipoGas`, `voltaje`, `notasTecnicas`) directly into `OrdenTrabajo`. The existing `tipo`, `marcaId`, `modeloId`, `numeroSerie`, `imei` fields are already on the order. A single SQL migration copies data from `dispositivos` → `ordenes_trabajo`, then drops the table. Both repos deploy atomically (NFR-2).

Backend: delete 11 Dispositivo-related Java files, modify 6, add inline validation to `OrdenController.create()`. Frontend: delete 2 component files, modify 8, add 4 device fields to `OrdenTrabajo` type and `OrdenRequest`.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Embed vs. inline JSON column | JSON loses queryability; embedding keeps typed columns | **Embed** — columns are typed, small count (4), queryable |
| Keep `TipoDispositivo` enum | Renaming to `TipoEquipo` would cascade across both repos + DB | **Keep enum** — cosmetic rename deferred to a follow-up to limit blast radius |
| Validation in controller vs. domain service | Domain service is "purer" but adds a file; controller is simpler | **Controller inline** — matches existing `OrdenController` pattern, no new classes |
| Client-side filter for `ClienteDetailPage` orders | Backend could add `?clienteId=` query param; frontend already fetches all orders | **Client-side filter** — consistent with current `useOrdenes()` pattern, no backend change needed |

## Data Flow

```
                          ┌─────────────────────────────┐
                          │       SQL Migration          │
                          │  UPDATE ordenes_trabajo      │
                          │  SET capacidad = d.capacidad  │
                          │  FROM dispositivos d          │
                          │  WHERE o.dispositivo_id = d.id│
                          └──────────────┬──────────────┘
                                         │
                                         ▼
┌──────────┐    POST /api/ordenes    ┌──────────────┐    ┌────────────┐
│  React   │ ──────────────────────→ │ OrdenController│──→│ OrdenEntity │
│  Frontend│                         │ (inline valid) │   │ (DB row)   │
└──────────┘                         └──────────────┘    └────────────┘
                                         │
                                         ▼
                                   ┌──────────────┐
                                   │ OrdenTrabajo  │
                                   │ (domain model)│
                                   │ +capacidad    │
                                   │ +tipoGas      │
                                   │ +voltaje      │
                                   │ +notasTecnicas│
                                   └──────────────┘
```

## File Changes

### Frontend — DELETE (2 files)

| File | Description |
|------|-------------|
| `src/pages/DispositivosPage.tsx` | Standalone dispositivos CRUD page — entire entity removed |
| `src/components/molecules/DispositivoForm.tsx` | Modal form for creating/editing dispositivos |

### Frontend — MODIFY (8 files)

| File | Action | Description |
|------|--------|-------------|
| `src/types/index.ts` | Modify | Remove `Dispositivo` interface, `DispositivoRequest`, `dispositivoId` from `OrdenTrabajo` and `OrdenRequest`. Add `capacidad`, `tipoGas`, `voltaje`, `notasTecnicas` to `OrdenTrabajo` and `OrdenRequest` |
| `src/hooks/useQueries.ts` | Modify | Delete `useDispositivos`, `useDispositivosPorCliente`, `useDispositivo`. Remove `Dispositivo` from imports |
| `src/App.tsx` | Modify | Remove `DispositivosPage` import and `/dispositivos` route (lines 11, 118-125) |
| `src/components/organisms/Sidebar.tsx` | Modify | Remove `{ path: '/dispositivos', label: 'Dispositivos', icon: 'smartphone' }` from `navGroups` Catálogo items (line 34) |
| `src/pages/ClienteDetailPage.tsx` | Modify | Remove tab layout, `useDispositivosPorCliente` query, `DispositivoRow` type, dispositivos DataTable. Replace with single order table with device columns (tipo, marca, modelo, IMEI/Serie) |
| `src/pages/OrdenesPage.tsx` | Modify | Remove `dispositivoId` preload, `useDispositivos`/`useDispositivo` imports, `dispositivoMap` memo. Rename "Dispositivo" column label → "Equipo". Build device label from `orden.tipo`/`modeloId`/`marcaId` directly. Add `capacidad`/`tipoGas`/`voltaje`/`notasTecnicas` state to create modal. Remove `createDispositivoId` state |
| `src/pages/OrdenDetailPage.tsx` | Modify | Remove `useDispositivo(orden?.dispositivoId)` query, all `dispositivo?.xxx` fallback lookups. Read device fields directly from `orden.capacidad`/`tipoGas`/`voltaje`/`notasTecnicas`. Add these 4 fields to the "Equipo" card display |
| `src/utils/maps.ts` | No change needed | `TipoDispositivo` enum stays (see Decision: keep enum). All `categoriaDeTipo` / `buildMarcasPorCategoria` logic remains correct |

### Frontend — NO CHANGE (preserved)

| File | Reason |
|------|--------|
| `src/utils/formatters.ts` | `TipoDispositivo` enum, `TIPO_DISPOSITIVO_LABELS`, `tipoDispositivoLabel`, `tipoBadgeConfig` — all stay as-is (enum not renamed) |
| `src/pages/PublicRepairStatusPage.tsx` | `formatDevice` returns `'Dispositivo'` as fallback label (line 63) — cosmetic, low priority; can rename to `'Equipo'` in a follow-up |
| `src/utils/ordenes.ts` | No dispositivo references |

## Interfaces / Contracts

### TypeScript — `OrdenTrabajo` (after)

```typescript
export interface OrdenTrabajo {
  id: number;
  clienteId: number;
  tecnicoId?: number | null;
  marcaId?: number | null;
  modeloId?: number | null;
  tipo?: TipoDispositivo | null;
  numeroSerie?: string | null;
  imei?: string | null;
  capacidad?: string | null;     // NEW
  tipoGas?: string | null;       // NEW
  voltaje?: string | null;       // NEW
  notasTecnicas?: string | null; // NEW
  estado: EstadoOrden;
  falloReportado: string | null;
  precioTotal: number | null;
  fechaEntrada: string;
  fechaSalida: string | null;
  fechaEntrega?: string | null;
  notas: string | null;
  reparaciones: Reparacion[];
  createdAt: string;
}
```

### TypeScript — `OrdenRequest` (after)

```typescript
export interface OrdenRequest {
  clienteId: number;
  tecnicoId?: number | null;
  marcaId?: number;
  modeloId?: number;
  tipo?: TipoDispositivo;
  numeroSerie?: string;
  imei?: string;
  capacidad?: string;     // NEW
  tipoGas?: string;       // NEW
  voltaje?: string;       // NEW
  notasTecnicas?: string; // NEW
  falloReportado?: string;
  notas?: string;
  tipoReparacion?: TipoReparacion;
  precioRevision?: number;
}
```

### Deleted types

- `Dispositivo` interface
- `DispositivoRequest` interface
- `dispositivoId` field from `OrdenTrabajo` and `OrdenRequest`

### SQL Migration (backend repo)

```sql
-- 1. Add new columns
ALTER TABLE ordenes_trabajo
  ADD COLUMN capacidad VARCHAR(100),
  ADD COLUMN tipo_gas VARCHAR(50),
  ADD COLUMN voltaje VARCHAR(50),
  ADD COLUMN notas_tecnicas TEXT;

-- 2. Migrate data from dispositivos
UPDATE ordenes_trabajo ot
  JOIN dispositivos d ON ot.dispositivo_id = d.id
  SET ot.capacidad = d.capacidad,
      ot.tipo_gas = d.tipo_gas,
      ot.voltaje = d.voltaje,
      ot.notas_tecnicas = d.notas_tecnicas;

-- 3. Drop FK + column
ALTER TABLE ordenes_trabajo DROP FOREIGN KEY fk_OrdenTrabajo_dispositivo;
ALTER TABLE ordenes_trabajo DROP COLUMN dispositivo_id;

-- 4. Drop dispositivos table
DROP TABLE dispositivos;
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `TipoDispositivo` enum used correctly in formatters/maps | Existing tests unchanged — enum not renamed |
| Integration | Create order with all device fields (3 device types) | `POST /api/ordenes` with `tipo=CELULAR` + `imei` required; `tipo=LINEA_BLANCA` + `tipoGas`+`voltaje` required; `tipo=COMPUTADORA` + `numeroSerie` required |
| Integration | Per-device-type validation (400 errors) | CELULAR without imei → 400; LINEA_BLANCA without tipoGas → 400; COMPUTADORA without numeroSerie → 400 |
| E2E | `ClienteDetailPage` shows orders with device columns, no tabs | Navigate to `/clientes/{id}`, verify single order table, no tab UI |
| E2E | Create order from `ClienteDetailPage` via `/reparaciones?clienteId={id}` | Click "Nueva Reparación", verify client pre-selected, no device pre-selected |
| E2E | `OrdenDetailPage` shows device fields inline | View order, verify Tipo/Marca/Modelo/Serie/IMEI/Capacidad/TipoGas/Voltaje/NotasTécnicas displayed from order directly |
| E2E | `/dispositivos` route removed | Navigate to `/dispositivos`, verify redirect to `/` |
| E2E | Sidebar no longer shows "Dispositivos" link | Verify sidebar Catálogo section without dispositivos |
| SQL | Migration preserves data | Verify `SELECT * FROM ordenes_trabajo` has migrated capacidad/tipoGas/voltaje/notasTecnicas; `dispositivos` table gone |
| Compile | Frontend compiles | `npx tsc -b` passes with zero errors |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. This is a pure domain model + UI refactor.

## Migration / Rollout

**Atomic deploy required** (NFR-2, NFR-3): DB migration + backend + frontend deploy together. No gradual rollout possible — the API contract is backward-incompatible (removes `dispositivoId` from request/response).

**Rollback plan**:
1. Restore the `dispositivos` table from backup (or reverse-migration SQL)
2. Re-deploy previous backend version (restores `/api/dispositivos` endpoints)
3. Re-deploy previous frontend version (restores `/dispositivos` route + `DispositivoForm`)
4. No data loss risk: the migration only copies data, never deletes source rows before confirming the copy

**Reverse migration SQL** (emergency):
```sql
CREATE TABLE dispositivos AS SELECT * FROM ordenes_trabajo WHERE 1=0;
-- Re-insert rows that had dispositivo_id from backup
ALTER TABLE ordenes_trabajo ADD COLUMN dispositivo_id BIGINT;
-- Re-link via some heuristic or backup
```

## Open Questions

- [ ] Should the `OrdenesPage` create modal gain `capacidad`/`tipoGas`/`voltaje`/`notasTecnicas` fields in Step 1 (equipo) for LINEA_BLANCA types? Currently it only has IMEI + NumeroSerie. **Recommendation**: add conditional fields matching the same pattern as `DispositivoForm.tsx` (lines 291-333) — show capacity/gas/voltage when tipo is LINEA_BLANCA.
- [ ] Backend `OrdenController` needs to handle the same conditional field display? No — backend just validates. Frontend controls which fields are visible per tipo.
