import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useEventStore } from '../../stores/event-store';
import { useTaskStore } from '../../stores/task-store';
import { EventItem } from './EventItem';
import type { EventType, AppEvent } from '../../lib/types';

const ALL_EVENT_TYPES: EventType[] = [
  'task_created',
  'task_assigned',
  'plan_submitted',
  'plan_approved',
  'plan_rejected',
  'execution_started',
  'execution_progress',
  'execution_completed',
  'agent_question',
  'diff_ready',
  'review_approved',
  'review_rejected',
  'review_changes_requested',
  'merge_started',
  'merge_completed',
  'merge_failed',
  'task_completed',
  'task_errored',
  'task_rejected',
  'slot_claimed',
  'slot_released',
  'conflict_detected',
];

export function ActivityFeed() {
  const events = useEventStore((s) => s.events);
  const loading = useEventStore((s) => s.loading);
  const hasMore = useEventStore((s) => s.hasMore);
  const fetchEvents = useEventStore((s) => s.fetchEvents);
  const loadMore = useEventStore((s) => s.loadMore);
  const tasks = useTaskStore((s) => s.tasks);

  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [taskFilter, setTaskFilter] = useState<string>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < 100 && hasMore && !loading) {
      loadMore();
    }
  }, [hasMore, loading, loadMore]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (typeFilter !== 'all' && event.event_type !== typeFilter) return false;
      if (taskFilter !== 'all' && event.task_id !== taskFilter) return false;
      return true;
    });
  }, [events, typeFilter, taskFilter]);

  // Build task list for filter dropdown
  const taskOptions = useMemo(() => {
    const taskIds = new Set(events.map((e) => e.task_id).filter(Boolean));
    return Array.from(taskIds).map((id) => ({
      id: id!,
      title: tasks[id!]?.title || id!,
    }));
  }, [events, tasks]);

  return (
    <div className="p-6 flex flex-col h-full max-w-4xl animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">Activity Feed</h2>

        <div className="flex items-center gap-2">
          {/* Event type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-surface border border-border/60 rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent/40 ring-1 ring-white/[0.03]"
          >
            <option value="all">All Events</option>
            {ALL_EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          {/* Task filter */}
          <select
            value={taskFilter}
            onChange={(e) => setTaskFilter(e.target.value)}
            className="bg-surface border border-border/60 rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent/40 max-w-[200px] ring-1 ring-white/[0.03]"
          >
            <option value="all">All Tasks</option>
            {taskOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title.length > 30 ? t.title.slice(0, 30) + '...' : t.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto space-y-0.5"
      >
        {filteredEvents.length === 0 && !loading ? (
          <div className="text-text-muted text-sm py-12 text-center rounded-xl border border-dashed border-border">
            No events to show.
          </div>
        ) : (
          filteredEvents.map((event) => (
            <EventItem key={event.id} event={event} />
          ))
        )}
        {loading && (
          <div className="text-text-muted text-xs py-4 text-center animate-pulse-subtle">
            Loading...
          </div>
        )}
        {!hasMore && filteredEvents.length > 0 && (
          <div className="text-text-muted text-xs py-4 text-center">
            End of activity log.
          </div>
        )}
      </div>
    </div>
  );
}
