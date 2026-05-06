import React from 'react';
import { captureException } from '../utils/logger';

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    captureException(error, { info });
  }

  handleReload = () => {
    // simple recovery: reload the page
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-lg text-center">
            <h2 className="text-2xl font-semibold mb-4">Algo salió mal</h2>
            <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">Se ha detectado un error. Intenta recargar la página o comunicate con el equipo.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={this.handleReload} className="px-4 py-2 bg-emerald-600 text-white rounded-md">Recargar</button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
