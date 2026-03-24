import { TaskCreator } from '../tasks/TaskCreator';
import { SlotIndicator } from '../slots/SlotIndicator';

interface HeaderProps {
  isConnected: boolean;
}

export function Header({ isConnected }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-surface/80 backdrop-blur-md border-b border-border z-30 flex items-center px-5">
      {/* Left: Logo */}
      <div className="font-semibold text-text-primary text-base whitespace-nowrap tracking-tight">
        Agent Pool
      </div>

      {/* Center: Task Creator */}
      <TaskCreator />

      {/* Right: Slots + Connection Status */}
      <div className="flex items-center gap-3">
        <SlotIndicator />
        <div className="flex items-center gap-1.5" title={isConnected ? 'Connected' : 'Disconnected'}>
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green' : 'bg-red'}`} />
          <span className="text-xs text-text-muted">{isConnected ? 'Live' : 'Offline'}</span>
        </div>
      </div>
    </header>
  );
}
