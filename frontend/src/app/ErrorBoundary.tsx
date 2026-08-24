import { AlertTriangle } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '../components/ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last-resort boundary for render-time crashes.
 *
 * It deliberately shows no patient context in the fallback - a crash screen is exactly
 * the kind of surface that ends up in a screenshot or a support ticket.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle className="size-6" aria-hidden />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-slate-900">
            The application encountered an error
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Nothing was saved or sent. Reload the page to continue; if this keeps happening,
            report it to your system administrator.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => this.setState({ error: null })}>
              Dismiss
            </Button>
            <Button onClick={() => window.location.reload()}>Reload page</Button>
          </div>
        </div>
      </div>
    );
  }
}
