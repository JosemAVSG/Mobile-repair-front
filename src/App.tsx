import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { MainLayout } from './components/templates/MainLayout';
import { RequireRole } from './components/auth/RequireRole';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MarcasPage } from './pages/MarcasPage';
import { ModelosPage } from './pages/ModelosPage';
import { ClientesPage } from './pages/ClientesPage';
import { ClienteDetailPage } from './pages/ClienteDetailPage';
import { DispositivosPage } from './pages/DispositivosPage';
import { OrdenesPage } from './pages/OrdenesPage';
import { OrdenDetailPage } from './pages/OrdenDetailPage';
import { PublicRepairStatusPage } from './pages/PublicRepairStatusPage';
import { TarifasPage } from './pages/TarifasPage';
import { RepuestosPage } from './pages/RepuestosPage';
import { ConfiguracionPage } from './pages/ConfiguracionPage';
import { TecnicosPage } from './pages/TecnicosPage';
import { InventarioPage } from './pages/InventarioPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Misma URL /reparaciones/:id para clientes (público) y usuarios autenticados.
// Autenticado → detalle interno; sin sesión → timeline público de seguimiento.
function RepairStatusRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <OrdenDetailPage /> : <PublicRepairStatusPage />;
}

// Redirect de compatibilidad: /ordenes → /reparaciones (enlaces/QR emitidos)
function RedirectToReparaciones() {
  const { id } = useParams<{ id: string }>();
  return (
    <Navigate to={id ? `/reparaciones/${id}` : '/reparaciones'} replace />
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Ruta compartida: pública o interna según autenticación */}
      <Route path="reparaciones/:id" element={<RepairStatusRoute />} />

      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <RequireRole roles={['ADMIN']}>
              <DashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="marcas"
          element={
            <RequireRole roles={['ADMIN']}>
              <MarcasPage />
            </RequireRole>
          }
        />
        <Route
          path="modelos"
          element={
            <RequireRole roles={['ADMIN']}>
              <ModelosPage />
            </RequireRole>
          }
        />
        <Route
          path="clientes"
          element={
            <RequireRole roles={['ADMIN']}>
              <ClientesPage />
            </RequireRole>
          }
        />
        <Route
          path="clientes/:id"
          element={
            <RequireRole roles={['ADMIN']}>
              <ClienteDetailPage />
            </RequireRole>
          }
        />
        <Route
          path="dispositivos"
          element={
            <RequireRole roles={['ADMIN']}>
              <DispositivosPage />
            </RequireRole>
          }
        />
        <Route path="reparaciones" element={<OrdenesPage />} />
        <Route path="ordenes" element={<RedirectToReparaciones />} />
        <Route path="ordenes/:id" element={<RedirectToReparaciones />} />
        <Route
          path="tarifas"
          element={
            <RequireRole roles={['ADMIN']}>
              <TarifasPage />
            </RequireRole>
          }
        />
        <Route
          path="repuestos"
          element={
            <RequireRole roles={['ADMIN']}>
              <RepuestosPage />
            </RequireRole>
          }
        />
        <Route
          path="inventario"
          element={
            <RequireRole roles={['ADMIN']}>
              <InventarioPage />
            </RequireRole>
          }
        />
        <Route
          path="configuracion"
          element={
            <RequireRole roles={['ADMIN']}>
              <ConfiguracionPage />
            </RequireRole>
          }
        />
        <Route
          path="tecnicos"
          element={
            <RequireRole roles={['ADMIN']}>
              <TecnicosPage />
            </RequireRole>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
