import { useEffect, useRef, useState } from 'react';
import { wsManager } from '../api/ws';
import { useTaskStore } from '../stores/task-store';
import { useSlotStore } from '../stores/slot-store';
import { useEventStore } from '../stores/event-store';
import { useToastStore } from '../stores/toast-store';
import type { WSMessage } from '../lib/types';

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateTask = useTaskStore((s) => s.updateTaskInStore);
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const updateSlot = useSlotStore((s) => s.updateSlotInStore);
  const prependEvent = useEventStore((s) => s.prependEvent);
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    const handler = (message: WSMessage) => {
      const { type, data } = message;

      switch (type) {
        case 'task.created':
        case 'task.updated': {
          if (data) {
            updateTask(data);

            // Show toast for attention-needing tasks not currently viewed
            if (
              (data.status === 'awaiting_approval' ||
                data.status === 'awaiting_review') &&
              data.id !== selectedTaskId
            ) {
              const label =
                data.status === 'awaiting_approval'
                  ? 'plan ready for review'
                  : 'diff ready for review';
              addToast(`${data.title} -- ${label}`, data.id);
            }
          }
          break;
        }

        case 'plan.submitted':
        case 'plan.reviewed': {
          // Another agent's view components will handle refetching plans
          break;
        }

        case 'slot.updated': {
          if (data) {
            updateSlot(data);
          }
          break;
        }

        case 'event.new': {
          if (data) {
            prependEvent(data);
          }
          break;
        }

        case 'execution.progress': {
          // View components will handle progress display
          break;
        }

        case 'diff.ready': {
          // View components will handle diff loading
          break;
        }
      }
    };

    wsManager.subscribe(handler);
    wsManager.connect();

    // Poll connection status
    intervalRef.current = setInterval(() => {
      setIsConnected(wsManager.isConnected);
    }, 1000);

    return () => {
      wsManager.unsubscribe(handler);
      wsManager.disconnect();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { isConnected };
}
