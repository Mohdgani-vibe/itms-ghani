import { Component, type ErrorInfo, type ReactNode } from 'react';

import { actionButtonStyles } from '../lib/buttonStyles';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ITMS frontend render failure', error, errorInfo);
  }

  handleReload() {
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-50 px-4 py-12 text-zinc-900">
          <div className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-600">Portal Recovery</div>
            <h1 className="mt-3 text-2xl font-black tracking-tight">This page hit a frontend error.</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              The app prevented a blank screen and stopped rendering the current page. Reload the portal once. If the problem continues, report the route you were on and the role you used so the failing screen can be fixed directly.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition ${actionButtonStyles.add}`}
              >
                Reload Portal
              </button>
              <a
                href="/login"
                className="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50"
              >
                Return to Login
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}