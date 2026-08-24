import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { cn } from '../../lib/utils';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  notify: (toast: Omit<Toast, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, { container: string; Icon: typeof Info; icon: string }> = {
  success: {
    container: 'border-emerald-200 bg-white',
    Icon: CheckCircle2,
    icon: 'text-emerald-600',
  },
  error: { container: 'border-red-200 bg-white', Icon: AlertTriangle, icon: 'text-red-600' },
  info: { container: 'border-slate-200 bg-white', Icon: Info, icon: 'text-clinical-600' },
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = nextId++;
      setToasts((current) => [...current, { ...toast, id }]);
      // Errors stay longer: they usually carry an instruction the user needs to read.
      setTimeout(() => dismiss(id), toast.tone === 'error' ? 8000 : 4500);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      notify,
      success: (title, description) => notify({ tone: 'success', title, description }),
      error: (title, description) => notify({ tone: 'error', title, description }),
    }),
    [notify],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 no-print"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((toast) => {
          const style = TONE_STYLES[toast.tone];
          const Icon = style.Icon;
          return (
            <div
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg',
                style.container,
              )}
            >
              <Icon className={cn('mt-0.5 size-5 shrink-0', style.icon)} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-0.5 text-sm text-slate-600">{toast.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded p-0.5 text-slate-400 transition-colors hover:text-slate-700"
                aria-label="Dismiss notification"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider.');
  return context;
}
