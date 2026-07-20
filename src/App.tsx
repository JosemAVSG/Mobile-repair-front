import { Routes, Route, Navigate } from 'react-router-dom';
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
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
        <Route index element={<DashboardPage />} />
        <Route path="marcas" element={<MarcasPage />} />
        <Route path="modelos" element={<ModelosPage />} />
        <Route path="clientes" element={<ClientesPage />} />
        <Route path="clientes/:id" element={<ClienteDetailPage />} />
        <Route path="dispositivos" element={<DispositivosPage />} />
        <Route path="ordenes" element={<OrdenesPage />} />
        <Route path="ordenes/:id" element={<OrdenDetailPage />} />
        <Route path="tarifas" element={<TarifasPage />} />
        <Route path="repuestos" element={<RepuestosPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
