import { Bot } from 'lucide-react';
import { TaskCreator } from '../tasks/TaskCreator';
import { SlotIndicator } from '../slots/SlotIndicator';
import { RepoSelector } from './RepoSelector';
import { UserMenu } from './UserMenu';
import { useAuthStore } from '../../stores/auth-store';

interface HeaderProps {
  isConnected: boolean;
}

export function Header({ isConnected }: HeaderProps) {
  const selectedRepo = useAuthStore((s) => s.selectedRepo);

  return (
    <header className="fixed top-0 left-0 right-0 h-28 bg-surface/80 backdrop-blur-md border-b border-border z-30 flex items-center px-5">
      {/* Left: Logo */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-accent/10 border border-accent/20">
          <Bot className="w-[18px] h-[18px] text-accent" strokeWidth={2} />
        </div>
        <div className="font-semibold text-text-primary text-base whitespace-nowrap tracking-tight">
          Agent Pool
        </div>
      </div>

      {/* Repo Selector */}
      <div className="ml-4">
        <RepoSelector />
      </div>

      {/* Center: Task Creator (only if repo selected) */}
      {selectedRepo && <TaskCreator />}
      {!selectedRepo && <div className="flex-1" />}

      {/* Right: Slots + Connection Status + User Menu */}
      <div className="flex items-center gap-3">
        <SlotIndicator />
        <div className="flex items-center gap-1.5" title={isConnected ? 'Connected' : 'Disconnected'}>
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green' : 'bg-red'}`} />
          <span className="text-xs text-text-muted">{isConnected ? 'Live' : 'Offline'}</span>
        </div>
        <UserMenu />
      </div>
    </header>
  );
}
