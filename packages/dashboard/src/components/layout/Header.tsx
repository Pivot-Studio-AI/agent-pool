import { Bot } from 'lucide-react';
import { TaskCreator } from '../tasks/TaskCreator';
import { SlotIndicator } from '../slots/SlotIndicator';
import { RepoSelector } from './RepoSelector';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import { useAuthStore } from '../../stores/auth-store';

interface HeaderProps {
  isConnected: boolean;
}

export function Header({ isConnected }: HeaderProps) {
  const selectedRepo = useAuthStore((s) => s.selectedRepo);

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-surface/70 backdrop-blur-xl border-b border-border z-30 flex items-center px-4 gap-3">
      {/* Left: Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent/10 shadow-glow-accent">
          <Bot className="w-4 h-4 text-accent" strokeWidth={2.5} />
        </div>
        <span className="font-semibold text-text-primary text-sm tracking-tight">
          Agent Pool
        </span>
      </div>

      {/* Repo Selector */}
      <div className="shrink-0">
        <RepoSelector />
      </div>

      {/* Center: Task Creator (only if repo selected) */}
      {selectedRepo ? <TaskCreator /> : <div className="flex-1" />}

      {/* Right: Slots + Connection + Theme + User */}
      <div className="flex items-center gap-3 shrink-0">
        <SlotIndicator />
        <div className="flex items-center gap-1.5" title={isConnected ? 'Connected' : 'Disconnected'}>
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green animate-pulse-subtle' : 'bg-red'}`} />
          <span className="text-[11px] text-text-muted font-medium">{isConnected ? 'Live' : 'Offline'}</span>
        </div>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
