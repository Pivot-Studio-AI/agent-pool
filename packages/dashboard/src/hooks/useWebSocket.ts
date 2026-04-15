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
  const setTestStatus = useTaskStore((s) => s.setTestStatus);
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

            // When a task moves to awaiting_review, tests start running automatically
            if (data.status === 'awaiting_review') {
              const prevTestStatus = useTaskStore.getState().testStatus[data.id];
              if (!prevTestStatus) {
                setTestStatus(data.id, 'running');
              }
            }

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
          break;
        }

        case 'diffs.tests_updated': {
          // Test results updated — update the task in store to trigger DiffReview re-render
          if (data?.task_id) {
            // Track test status for sidebar categorization
            if (data.test_results?.status) {
              setTestStatus(data.task_id, data.test_results.status);
            }
            // Force the task's updated_at to change so components re-fetch diffs
            const tasks = useTaskStore.getState().tasks;
            const task = tasks[data.task_id];
            if (task) {
              updateTask({ ...task, updated_at: new Date().toISOString() });
            }
            addToast('Test results updated', data.task_id);
          }
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
