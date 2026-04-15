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
        'w-full text-left px-3 py-2.5 rounded-lg text-sm group relative',
        isSelected
          ? 'bg-accent/10 shadow-glow-accent ring-1 ring-accent/15'
          : 'hover:bg-surface-hover'
      )}
    >
      {isSelected && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-accent rounded-r" />
      )}
      <div className={clsx(
        'truncate text-xs font-medium',
        isSelected ? 'text-accent' : 'text-text-primary group-hover:text-accent'
      )}>
        {task.title}
      </div>
      <div className="mt-1.5">
        <TaskStatusBadge status={task.status} taskId={task.id} />
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
    <div className="mb-6">
      <div className="flex items-center gap-2 px-3 mb-2">
        {dotColor && (
          <span className={clsx('w-1.5 h-1.5 rounded-full', dotColor)} />
        )}
        <span className="text-text-muted text-[10px] font-bold uppercase tracking-widest">
          {title}
        </span>
        <span className="text-text-muted/50 text-[10px] font-mono ml-auto">{tasks.length}</span>
      </div>
      <div className="space-y-0.5 px-1.5">
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
    <aside className="fixed left-0 top-14 bottom-0 w-60 glass border-r border-border/60 overflow-y-auto z-20">
      <div className="py-4">
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
