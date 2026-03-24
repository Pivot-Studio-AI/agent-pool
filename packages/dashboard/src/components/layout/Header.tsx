import { TaskCreator } from '../tasks/TaskCreator';
import { SlotIndicator } from '../slots/SlotIndicator';

interface HeaderProps {
  isConnected: boolean;
}

export function Header({ isConnected }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-surface border-b border-border z-30 flex items-center px-4">
      {/* Left: Logo */}
      <div className="font-bold text-text-primary text-sm whitespace-nowrap">
        Agent Pool
      </div>

      {/* Center: Task Creator */}
      <TaskCreator />

      {/* Right: Slots + Connection Status */}
      <div className="flex items-center gap-3">
        <SlotIndicator />
        <div
          title={isConnected ? 'Connected' : 'Disconnected'}
          className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green' : 'bg-red'}`}
        />
      </div>
    </header>
  );
}
