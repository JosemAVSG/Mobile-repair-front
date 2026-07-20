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
