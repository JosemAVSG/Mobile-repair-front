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

## Pendientes / Roadmap

Estado al 2026-08-20 (Etapas 1–3 completas). Cosas para retomar:

### Alta prioridad
- **Vista pública del cliente** con timeline de progreso (Ingresado → En reparación → Pendiente retiro → Finalizado). El QR del ticket (`/reparaciones/:id`) apunta hoy a una ruta **protegida**: el cliente no puede ver nada. Hacer una ruta pública de consulta.
- **Protección por rol en backend**: el JWT se valida (`JwtAuthFilter`) pero los endpoints no bloquean por rol (hoy cualquier token accede a `/api/tecnicos`). Proteger rutas admin.

### Media prioridad
- **Inventario** como módulo nuevo (NO confundir con Repuestos): stock por producto, stock mínimo, estados OK/bajo/sin stock, alertas de bajo stock, KPIs, registrar compras y consumos.
- **Planes** en Configuración (suscripciones del taller).
- Migrar `nombreTaller` y `logo` de la configuración a backend (`GET/PUT /api/configuracion`) — TODO marcado en `src/context/ConfigContext.tsx`. Los colores quedan en localStorage siempre.
- Tests: hoy hay 0 archivos de test.

### Baja prioridad
- Sistema de diseño formal (tokens semánticos en Tailwind, hoy clases utilitarias repetidas).
- `useDebounce` sin uso (SearchField tiene debounce propio) — limpiar o integrar.

### Producción (env vars)
- `VITE_API_URL` → URL del backend desplegado.
- Backend: `JWT_SECRET` (fuerte), `ADMIN_PASSWORD`, `CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud_name>`, `DB_*`.
- Rotar credenciales de Cloudinary si se compartieron por chat.
