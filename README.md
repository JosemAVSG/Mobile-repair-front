# Mobile Repair Frontend

Sistema de gestión para taller de reparación de dispositivos móviles y electrodomésticos.

## Requisitos

- Node.js 20+
- npm 10+

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173). El proxy de Vite redirige
`/api/*` a `http://localhost:8080/api/*`.

## Build

```bash
npm run build
npm run preview
```

## Tests

```bash
npm test          # watch mode
npm run test:run  # single run
```

## API

El frontend se conecta al backend **Mobile Repair API** que corre en
`http://localhost:8080`. Asegurate de tenerlo iniciado antes de trabajar
con funcionalidades que requieran datos.

## Stack

- **React 18** + **TypeScript**
- **Vite 5** (dev server, build)
- **Tailwind CSS v4** (estilos)
- **react-router-dom v6** (ruteo)
- **Vitest** + **Testing Library** (tests)

## Roles y permisos del backend

El frontend consume los endpoints con los roles `ADMIN` y `TECNICO`. A continuación
el mapa de acceso esperado:

| Endpoint | Rol / alcance requerido |
|---|---|
| `/api/auth/*` | Cualquier usuario autenticado |
| `GET /api/ordenes` | `ADMIN`: todas. `TECNICO`: `?tecnicoId={id}` o `?sinTecnico=true` |
| `POST /api/ordenes` | `ADMIN` o `TECNICO` (auto-asignada) |
| `GET /api/ordenes/:id` | `ADMIN` o `TECNICO` asignado a la orden |
| `PUT /api/ordenes/:id/{estado,entrega,tecnico}` | estado/entrega: `ADMIN` o `TECNICO` asignado; tecnico: `ADMIN` únicamente |
| `POST /api/ordenes/:id/reparaciones` | `ADMIN` o `TECNICO` asignado |
| `/api/ordenes/:id/fotos` y `DELETE /api/fotos/:id` | `ADMIN` o `TECNICO` asignado |
| `/api/clientes`, `/api/marcas`, `/api/modelos`, `/api/dispositivos`, `/api/tarifas`, `/api/repuestos`, `/api/tecnicos` | `ADMIN` únicamente |
| `/api/configuracion` | `ADMIN` únicamente |
| `GET /api/configuracion/public` | Público, sin autenticación |
| `GET /api/ordenes/:id/public` | Público, sin autenticación |
| `/api/inventario/*` | `ADMIN` únicamente |

En el frontend `RequireRole` y `useCan` centralizan estas mismas reglas: `ADMIN`
tiene acceso total, mientras que `TECNICO` solo puede operar sobre las órdenes
asignadas.

## Pendientes / Roadmap

Estado al 2026-08-21. Etapas 1–3 completas, más las capacidades de la etapa 4.

### Completado
- **Vista pública del cliente** (`/reparaciones/:id`): timeline de progreso (Ingresado → En reparación → Pendiente retiro → Finalizado) accesible sin login; la misma URL renderiza la vista interna cuando el usuario está autenticado.
- **Configuración de taller en backend**: `nombreTaller` y `logo` se leen y guardan desde `/api/configuracion`; el color primario permanece en `localStorage`.
- **Módulo de inventario**: productos con stock, stock mínimo, estados `OK`/`BAJO`/`SIN_STOCK`, alertas de bajo stock, KPIs, y registro de movimientos `COMPRA`/`CONSUMO`.
- **Protección por rol en backend y frontend**: rutas y acciones restringidas a `ADMIN`/`TECNICO`; el técnico solo ve y opera sobre sus órdenes asignadas.

### Media prioridad
- **Planes** en Configuración (suscripciones del taller).
- Tests: hoy hay 0 archivos de test.

### Baja prioridad
- Sistema de diseño formal (tokens semánticos en Tailwind, hoy clases utilitarias repetidas).
- `useDebounce` sin uso (SearchField tiene debounce propio) — limpiar o integrar.

### Producción (env vars)
- `VITE_API_URL` → URL del backend desplegado.
- Backend: `JWT_SECRET` (fuerte), `ADMIN_PASSWORD`, `CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud_name>`, `DB_*`.
- Rotar credenciales de Cloudinary si se compartieron por chat.
