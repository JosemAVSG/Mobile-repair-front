# Exploration: Client-Centric Refactor

## Current State

The system is **device-centric**: `OrdenTrabajo` references `Dispositivo` via `dispositivoId`, with partial duplication of device fields (`marcaId`, `modeloId`, `tipo`, `numeroSerie`, `imei`) already embedded in the order. The `Dispositivo` entity owns additional fields (`capacidad`, `tipoGas`, `voltaje`, `notasTecnicas`) that orders don't have.

**Data flow today**: Creating an order → implicit or explicit `Dispositivo` creation → `OrdenTrabajo.dispositivoId` references it. Frontend enriches order rows by looking up the `dispositivo` from a global map.

**Target**: `Cliente (1) ←→ (N) OrdenTrabajo` with ALL device info embedded directly in `OrdenTrabajo`. No separate `Dispositivo` entity.

## Affected Areas

### Backend (Mobile-repair-api) — 15 files

**DELETE (7 files):**
- `domain/model/Dispositivo.java` — domain model
- `domain/repository/DispositivoRepository.java` — repository interface
- `infrastructure/persistence/entity/DispositivoEntity.java` — JPA entity
- `infrastructure/persistence/repository/DispositivoJpaRepository.java` — Spring Data
- `infrastructure/persistence/repository/DispositivoRepositoryImpl.java` — repo impl
- `infrastructure/persistence/mapper/DispositivoMapper.java` — mapper
- `api/controller/DispositivoController.java` — REST controller (+ inner DispositivoRequest/Response)

**DELETE (4 files — factory pattern):**
- `domain/factory/DispositivoFactory.java`
- `domain/factory/CelularFactory.java`
- `domain/factory/LineaBlancaFactory.java`
- `domain/factory/ComputadoraFactory.java`

**MODIFY (4 files):**
- `domain/model/OrdenTrabajo.java` — remove `dispositivoId`, add `capacidad`, `tipoGas`, `voltaje`, `notasTecnicas`
- `infrastructure/persistence/entity/OrdenEntity.java` — mirror domain changes
- `infrastructure/persistence/mapper/OrdenMapper.java` — remove `dispositivoId`, add new fields
- `api/controller/OrdenController.java` — remove `DispositivoRepository` dependency, embed device creation logic inline, absorb factory validation

**MODIFY (2 DTOs):**
- `api/dto/OrdenRequest.java` — remove `dispositivoId`, add `capacidad`, `tipoGas`, `voltaje`, `notasTecnicas`
- `api/dto/OrdenResponse.java` — remove `dispositivoId`, add `capacidad`, `tipoGas`, `voltaje`, `notasTecnicas`

**MODIFY (2 files — DB):**
- `schema.sql` — add new columns to `ordenes_trabajo`, drop `dispositivos` table and FK
- `seed.sql` — remove `dispositivos_tipo_check` constraint references

**NO CHANGE:**
- `domain/repository/OrdenRepository.java` — already has `findByClienteId()`
- `domain/enums/TipoDispositivo.java` — still needed for order device type
- `Cliente.java`, `ClienteEntity.java`, `ClienteController.java` — no changes
- `PublicRepairStatusResponse.java` — already uses marca/modelo names, not dispositivo

### Frontend (mobile-repair-front) — 11 files

**DELETE (2 files):**
- `pages/DispositivosPage.tsx` — entire CRUD page for Dispositivo entity
- `components/molecules/DispositivoForm.tsx` — modal form used only by DispositivosPage

**MODIFY (7 files):**
- `types/index.ts` — remove `Dispositivo` interface, `DispositivoRequest` interface; update `OrdenTrabajo` (remove `dispositivoId`, add 4 fields); update `OrdenRequest` (remove `dispositivoId`, add 4 fields)
- `hooks/useQueries.ts` — remove `useDispositivos()`, `useDispositivosPorCliente()`, `useDispositivo()`
- `App.tsx` — remove `DispositivosPage` import, remove `/dispositivos` route
- `components/organisms/Sidebar.tsx` — remove "Dispositivos" from Catálogo nav group
- `pages/ClienteDetailPage.tsx` — remove dispositivos tab entirely, make "ordenes" the default/only tab; remove `useDispositivosPorCliente` usage
- `pages/OrdenesPage.tsx` — remove `dispositivoMap`, `useDispositivos`, `useDispositivo`, preload-from-dispositivoId logic; rename column from "Dispositivo" to "Equipo"; simplify create modal (remove `createDispositivoId` state); device info now comes directly from order fields
- `pages/OrdenDetailPage.tsx` — remove `useDispositivo(orden?.dispositivoId)` call; device info now reads from `orden.tipo`, `orden.modeloId`, etc. directly; add display of new fields (capacidad, tipoGas, voltaje, notasTecnicas)

**MODIFY (1 utility):**
- `utils/maps.ts` — remove `buildClienteMap` if no longer used elsewhere (check first)

**NO CHANGE:**
- `pages/DashboardPage.tsx` — already client-centric, no dispositivo references
- `pages/PublicRepairStatusPage.tsx` — only shows marca/modelo names
- `components/organisms/TicketEquipoModal.tsx` — check for dispositivo references (minor)

## Dependency Graph

```
Phase 1: DB Migration (backend)
  └── schema.sql: Add columns to ordenes_trabajo, migrate data, drop dispositivos

Phase 2: Backend Domain + Infrastructure
  ├── OrdenTrabajo.java (remove dispositivoId, add 4 fields)
  ├── OrdenEntity.java (mirror)
  ├── OrdenMapper.java (mirror)
  ├── DELETE: Dispositivo*.java (all 7 device files)
  ├── DELETE: DispositivoFactory*.java (all 4 factory files)

Phase 3: Backend API
  ├── OrdenRequest.java (remove dispositivoId, add 4 fields)
  ├── OrdenResponse.java (remove dispositivoId, add 4 fields)
  └── OrdenController.java (remove DispositivoRepository, inline validation, simplify create)

Phase 4: Frontend Types + Hooks
  ├── types/index.ts (update types)
  └── hooks/useQueries.ts (remove dispositivo hooks)

Phase 5: Frontend Pages
  ├── App.tsx (remove route)
  ├── Sidebar.tsx (remove nav item)
  ├── DELETE: DispositivosPage.tsx
  ├── DELETE: DispositivoForm.tsx
  ├── ClienteDetailPage.tsx (remove dispositivos tab)
  ├── OrdenesPage.tsx (remove dispositivo references)
  └── OrdenDetailPage.tsx (remove useDispositivo, use orden fields directly)
```

## Risk Areas

### HIGH RISK
1. **Data migration**: Existing `dispositivos` rows must be migrated to `ordenes_trabajo` columns BEFORE dropping the table. SQL: `UPDATE ordenes_trabajo SET marca_id = d.marca_id (via modelo→marca), modelo_id = d.modelo_id, tipo = d.tipo, ... FROM dispositivos d WHERE ordenes_trabajo.dispositivo_id = d.id`.
2. **OrdenTrabajo constructor change**: `OrdenTrabajo(Long id, Long clienteId, Long dispositivoId, EstadoOrden estado)` is used in `OrdenMapper.toDomain()` — must update constructor signature.

### MEDIUM RISK
3. **Factory validation migration**: `CelularFactory` validates IMEI required, `LineaBlancaFactory` validates tipoGas+voltaje required, `ComputadoraFactory` validates numeroSerie required. These validations must move to `OrdenController.create()` or be lost.
4. **Frontend preload flow**: `OrdenesPage` has complex logic to preload from `?dispositivoId=X&clienteId=Y` query params. The `dispositivoId` param must be removed; `clienteId` param stays.
5. **ClienteDetailPage tab redesign**: Currently has 2 tabs (Dispositivos + Ordenes). After refactor, the "Dispositivos" tab has no meaning — needs to become a single-list page showing orders with device info columns.

### LOW RISK
6. **PublicRepairStatusPage**: Only uses `marca`/`modelo` names — unaffected.
7. **DashboardPage**: No dispositivo references — unaffected.
8. **Tarifa resolution**: `resolverTarifaActiva()` uses `orden.getModeloId()` and `orden.getMarcaId()` — already works with embedded fields.

## Migration Strategy

### SQL Migration Script (order matters!)

```sql
-- Step 1: Add new columns to ordenes_trabajo
ALTER TABLE ordenes_trabajo
  ADD COLUMN capacidad VARCHAR(20),
  ADD COLUMN tipo_gas VARCHAR(20),
  ADD COLUMN voltaje VARCHAR(10),
  ADD COLUMN notas_tecnicas TEXT;

-- Step 2: Migrate data from dispositivos → ordenes_trabajo
UPDATE ordenes_trabajo o
SET
  capacidad = d.capacidad,
  tipo_gas = d.tipo_gas,
  voltaje = d.voltaje,
  notas_tecnicas = d.notas_tecnicas
FROM dispositivos d
WHERE o.dispositivo_id = d.id;

-- Step 3: For orders WITHOUT dispositivo_id but with modelo_id,
-- backfill tipo from dispositivo if possible (already set in most cases)

-- Step 4: Drop FK constraint and column
ALTER TABLE ordenes_trabajo DROP CONSTRAINT IF EXISTS ordenes_trabajo_dispositivo_id_fkey;
ALTER TABLE ordenes_trabajo DROP COLUMN dispositivo_id;

-- Step 5: Drop dispositivos table
DROP TABLE dispositivos;
```

### Existing Data Concerns
- Some orders may have `dispositivo_id = NULL` (created before Dispositivo existed) — these already have `marca_id`, `modelo_id`, `tipo` embedded. The new nullable columns (`capacidad`, etc.) will just be NULL for these.
- Some orders may have `dispositivo_id` set but the dispositivo row was deleted — FK is nullable, so these orders would get NULL for the 4 new columns. Acceptable.

## Estimated Scope

| Area | Files Changed | Files Deleted | Approx. Lines |
|------|:---:|:---:|---:|
| Backend Domain + Infra | 4 | 11 | ~150 modified, ~400 deleted |
| Backend API | 2 | 0 | ~80 modified |
| Backend DB | 2 | 0 | ~50 modified + migration SQL |
| Frontend Types + Hooks | 2 | 0 | ~60 modified, ~20 deleted |
| Frontend Pages + Components | 5 | 2 | ~400 modified, ~900 deleted |
| **Total** | **15** | **13** | **~740 modified, ~1320 deleted** |

**Net effect**: ~580 fewer lines of code. The system becomes simpler.

## Key Decisions Needed

1. **Validation on order create**: Should we keep per-device-type validation (IMEI required for CELULAR, tipoGas+voltaje required for LINEA_BLANCA, numeroSerie required for COMPUTADORA)? If yes, the OrdenController.create() needs a new validation block. **Recommendation**: Yes, keep validation — just move it inline.

2. **ClienteDetailPage after refactor**: Should it show a single table of orders with device columns (tipo, marca, modelo, IMEI), or keep two tabs (DeviceInfo summary + Orders list)? **Recommendation**: Single table — the device info IS in each order row now.

3. **OrdenesPage "Dispositivo" column rename**: Should the column be renamed to "Equipo" (more natural in Spanish for the combined device info)? **Recommendation**: Yes, rename to "Equipo".

4. **Backward compatibility**: Should the backend keep accepting `dispositivoId` in `OrdenRequest` temporarily (ignored or migrated on-the-fly) during a transition period? **Recommendation**: No — clean break. The frontend and backend deploy together.
