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

// Detalle interno dentro del layout para usuarios autenticados.
function AuthenticatedRepairDetail() {
  return (
    <MainLayout>
      <OrdenDetailPage />
    </MainLayout>
  );
}

// Redirección de compatibilidad para QR antiguos: si el cliente escanea
// /reparaciones/:id sin sesión, lo mandamos a la ruta pública /estado/:id.
function PublicRepairRedirect() {
  const { isAuthenticated } = useAuth();
  const { id } = useParams<{ id: string }>();
  if (isAuthenticated) {
    return <AuthenticatedRepairDetail />;
  }
  return <Navigate to={`/estado/${id}`} replace />;
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

      {/* /reparaciones/:id mantiene compatibilidad con QR antiguos.
          Autenticado → detalle con layout; sin sesión → redirige a /estado/:id. */}
      <Route path="reparaciones/:id" element={<PublicRepairRedirect />} />

      {/* Ruta pública para clientes que escanean el QR. */}
      <Route path="estado/:id" element={<PublicRepairStatusPage />} />

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
