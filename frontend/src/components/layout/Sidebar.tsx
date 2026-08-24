import {
  Activity,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { cn } from '../../lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/analysis/new', label: 'New Analysis', icon: Activity },
  { to: '/patients', label: 'Patients', icon: Users },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main navigation">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-clinical-50 text-clinical-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                className={cn('size-4.5 shrink-0', isActive ? 'text-clinical-600' : 'text-slate-400')}
                aria-hidden
              />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-5">
      <div className="flex size-8 items-center justify-center rounded-lg bg-clinical-600 text-white">
        <Activity className="size-4.5" aria-hidden />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-slate-900">CXR Analysis</p>
        <p className="text-xs text-slate-500">Decision support</p>
      </div>
    </div>
  );
}

function SafetyFooter() {
  return (
    <div className="border-t border-slate-200 px-5 py-4">
      <p className="text-[11px] leading-relaxed text-slate-500">
        AI output is decision support only and must be reviewed by a qualified healthcare
        professional.
      </p>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex no-print">
      <Brand />
      <NavItems />
      <SafetyFooter />
    </aside>
  );
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden no-print">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
        aria-label="Close navigation menu"
      />
      <div
        className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pr-2">
          <div className="flex-1">
            <Brand />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close navigation menu"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <NavItems onNavigate={onClose} />
        <SafetyFooter />
      </div>
    </div>
  );
}
