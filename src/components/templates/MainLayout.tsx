import { useState, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../organisms/Sidebar';
import { Header } from '../organisms/Header';
import { SuspendedBanner } from '../organisms/SuspendedBanner';
import { TrialBanner } from '../organisms/TrialBanner';
import { Breadcrumbs } from '../molecules/Breadcrumbs';
import { useAuth } from '../../hooks/useAuth';
import { useSidebarCollapsed } from '../../hooks/useSidebarCollapsed';
import { shouldShowSidebar } from '../../utils/navigation';

export const SIDEBAR_ID = 'app-sidebar';

interface MainLayoutProps {
  children?: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { collapsed, toggle } = useSidebarCollapsed();
  const { user } = useAuth();
  const hasSidebar = shouldShowSidebar(user?.rol === 'ADMIN');

  return (
    <div className="flex min-h-screen bg-slate-50">
      {hasSidebar && (
        <Sidebar
          id={SIDEBAR_ID}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={collapsed}
        />
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <SuspendedBanner />
        <TrialBanner />
        <Header
          hasSidebar={hasSidebar}
          sidebarCollapsed={collapsed}
          sidebarId={SIDEBAR_ID}
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
          onSidebarCollapseToggle={toggle}
        />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Breadcrumbs />
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
