import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { MainLayout } from './components/templates/MainLayout';
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
import { TarifasPage } from './pages/TarifasPage';
import { RepuestosPage } from './pages/RepuestosPage';
import { ConfiguracionPage } from './pages/ConfiguracionPage';
import { TecnicosPage } from './pages/TecnicosPage';
import type { RolUsuario } from './types';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/** Requiere que el usuario tenga uno de los roles indicados; si no, lo
 *  redirige a /reparaciones (la única página accesible para todo rol). */
function RequireRole({
  roles,
  children,
}: {
  roles: RolUsuario[];
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.rol)) {
    return <Navigate to="/reparaciones" replace />;
  }

  return <>{children}</>;
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
        <Route path="reparaciones/:id" element={<OrdenDetailPage />} />
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
