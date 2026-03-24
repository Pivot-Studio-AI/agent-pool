import { clsx } from 'clsx';
import {
  useTaskStore,
  getAttentionTasks,
  getActiveTasks,
  getQueuedTasks,
  getRecentTasks,
} from '../../stores/task-store';
import { TaskStatusBadge } from '../tasks/TaskStatusBadge';
import type { Task } from '../../lib/types';

function TaskItem({
  task,
  isSelected,
  onClick,
}: {
  task: Task;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all',
        isSelected
          ? 'bg-accent/10 border border-accent/20'
          : 'hover:bg-surface-hover border border-transparent'
      )}
    >
      <div className="truncate text-text-primary text-xs font-medium">
        {task.title}
      </div>
      <div className="mt-1">
        <TaskStatusBadge status={task.status} />
      </div>
    </button>
  );
}

function Section({
  title,
  dotColor,
  tasks,
  selectedId,
  onSelect,
}: {
  title: string;
  dotColor?: string;
  tasks: Task[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (tasks.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 px-3 py-1.5">
        {dotColor && (
          <span className={clsx('w-2 h-2 rounded-full', dotColor)} />
        )}
        <span className="text-text-secondary text-xs font-semibold uppercase tracking-wider">
          {title}
        </span>
        <span className="text-text-muted text-xs">{tasks.length}</span>
      </div>
      <div className="space-y-0.5 px-1">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            isSelected={task.id === selectedId}
            onClick={() => onSelect(task.id)}
          />
        ))}
      </div>
    </div>
  );
}

export function Sidebar() {
  const store = useTaskStore();
  const { selectedTaskId, selectTask } = store;

  const attention = getAttentionTasks(store);
  const active = getActiveTasks(store);
  const queued = getQueuedTasks(store);
  const recent = getRecentTasks(store);

  return (
    <aside className="fixed left-0 top-14 bottom-0 w-64 bg-surface/50 backdrop-blur-sm border-r border-border overflow-y-auto z-20">
      <div className="py-3">
        <Section
          title="Needs Attention"
          dotColor="bg-amber"
          tasks={attention}
          selectedId={selectedTaskId}
          onSelect={selectTask}
        />
        <Section
          title="In Progress"
          dotColor="bg-green"
          tasks={active}
          selectedId={selectedTaskId}
          onSelect={selectTask}
        />
        <Section
          title="Queued"
          tasks={queued}
          selectedId={selectedTaskId}
          onSelect={selectTask}
        />
        <Section
          title="Recent"
          tasks={recent}
          selectedId={selectedTaskId}
          onSelect={selectTask}
        />
      </div>
    </aside>
  );
}
