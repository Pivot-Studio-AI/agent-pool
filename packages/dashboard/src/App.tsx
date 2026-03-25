import { useEffect, Component, type ReactNode } from 'react';
import { Shell } from './components/layout/Shell';
import { LoginScreen } from './components/auth/LoginScreen';
import { useWebSocket } from './hooks/useWebSocket';
import { useAuthStore } from './stores/auth-store';

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ── Error Boundary ──────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary] Caught error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg flex items-center justify-center">
          <div className="bg-surface border border-border rounded-lg p-8 max-w-md text-center">
            <div className="text-red text-lg font-bold mb-2">Something went wrong</div>
            <div className="text-text-secondary text-sm mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-accent text-white rounded text-sm hover:bg-accent/80"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── App ──────────────────────────────────────────────────────────

function AppInner() {
  const { isAuthenticated, loading, initialize } = useAuthStore();
  const { isConnected } = useWebSocket();

  useEffect(() => {
    initialize();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingSpinner />;
  if (!isAuthenticated) return <LoginScreen />;

  return <Shell isConnected={isConnected} />;
}

export function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
