import { Github } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';

export function LoginScreen() {
  const login = useAuthStore((s) => s.login);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
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
      </div>
    </div>
  );
}
