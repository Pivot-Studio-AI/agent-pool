import { useEffect } from 'react';
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

export function App() {
  const { isAuthenticated, loading, initialize } = useAuthStore();
  const { isConnected } = useWebSocket();

  useEffect(() => {
    initialize();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingSpinner />;
  if (!isAuthenticated) return <LoginScreen />;

  return <Shell isConnected={isConnected} />;
}
