import { Shell } from './components/layout/Shell';
import { useWebSocket } from './hooks/useWebSocket';
import { useTaskStore } from './stores/task-store';
import { useSlotStore } from './stores/slot-store';
import { useEventStore } from './stores/event-store';
import { useEffect } from 'react';

export function App() {
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const fetchSlots = useSlotStore((s) => s.fetchSlots);
  const fetchEvents = useEventStore((s) => s.fetchEvents);
  const { isConnected } = useWebSocket();

  useEffect(() => {
    fetchTasks();
    fetchSlots();
    fetchEvents();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <Shell isConnected={isConnected} />;
}
