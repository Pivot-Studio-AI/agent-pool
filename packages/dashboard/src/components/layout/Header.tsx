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
    <header className="fixed top-0 left-0 right-0 h-14 glass border-b border-border/60 z-30 flex items-center px-5 gap-4">
      {/* Left: Logo */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-accent/20 to-purple/20 shadow-glow-accent ring-1 ring-accent/20">
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
      <div className="flex items-center gap-4 shrink-0">
        <SlotIndicator />
        <div className="flex items-center gap-2" title={isConnected ? 'Connected' : 'Disconnected'}>
          <span className="relative flex h-2 w-2">
            {isConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-40" />
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-green' : 'bg-red'}`} />
          </span>
          <span className="text-[11px] text-text-muted font-medium">{isConnected ? 'Live' : 'Offline'}</span>
        </div>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
