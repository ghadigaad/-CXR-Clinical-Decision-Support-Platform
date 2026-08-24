import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import { AiDisclaimerNote, DemoBanner, isDemoMode } from '../safety/Disclaimers';
import { MobileSidebar, Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <MobileSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMenu={() => setMenuOpen(true)} />
        {isDemoMode ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 sm:px-6 lg:px-8 no-print">
            <div className="mx-auto w-full max-w-7xl">
              <DemoBanner />
            </div>
          </div>
        ) : null}

        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl print-container">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8 no-print">
          <div className="mx-auto w-full max-w-7xl">
            <AiDisclaimerNote />
          </div>
        </footer>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
