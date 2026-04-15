import { useState } from 'react';
import { Bot, Github, Key, LogIn } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { ThemeToggle } from '../layout/ThemeToggle';

export function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const loginWithApiKey = useAuthStore((s) => s.loginWithApiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');

  const handleApiKeyLogin = async () => {
    setError('');
    try {
      await loginWithApiKey(apiKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header bar with login button */}
      <header className="fixed top-0 left-0 right-0 h-14 glass border-b border-border/60 z-30 flex items-center px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-accent/20 to-purple/20 shadow-glow-accent ring-1 ring-accent/20">
            <Bot className="w-4 h-4 text-accent" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-text-primary text-sm tracking-tight">
            Agent Pool
          </span>
        </div>
        <div className="flex-1" />
        <ThemeToggle />
        <button
          onClick={login}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-hover border border-border text-text-primary hover:border-text-muted/30 hover:bg-surface-raised active:scale-[0.97]"
        >
          <LogIn size={14} />
          Sign In
        </button>
      </header>

      {/* Centered login content */}
      <div className="flex-1 flex items-center justify-center pt-14">
        <div className="flex flex-col items-center gap-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-text-primary">Agent Pool</h1>
            <p className="mt-2 text-text-secondary">AI Development Operations</p>
          </div>
          <button
            onClick={login}
            className="flex items-center gap-2 bg-white text-black rounded-xl px-6 py-3 font-semibold hover:bg-gray-100 transition-colors"
          >
            <Github size={20} />
            Sign in with GitHub
          </button>

          <div className="text-text-muted text-sm">or</div>

          {!showApiKey ? (
            <button
              onClick={() => setShowApiKey(true)}
              className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              <Key size={16} />
              Sign in with API key
            </button>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApiKeyLogin()}
                placeholder="Enter API key"
                className="bg-surface border border-border rounded-lg px-4 py-2 text-text-primary text-sm w-64 focus:outline-none focus:border-accent"
                autoFocus
              />
              {error && <p className="text-red text-xs">{error}</p>}
              <button
                onClick={handleApiKeyLogin}
                disabled={!apiKey}
                className="bg-accent text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                Connect
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
