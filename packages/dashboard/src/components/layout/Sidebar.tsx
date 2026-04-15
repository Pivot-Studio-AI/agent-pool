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
        'w-full text-left px-3 py-2.5 text-sm group relative border-l-2',
        isSelected
          ? 'bg-accent/8 border-l-accent'
          : 'border-l-transparent hover:bg-surface-hover hover:border-l-border'
      )}
    >
      <div className={clsx(
        'truncate text-xs font-medium',
        isSelected ? 'text-accent' : 'text-text-primary group-hover:text-accent'
      )}>
        {task.title}
      </div>
      <div className="mt-1.5">
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
    <div className="mb-6">
      <div className="flex items-center gap-2 px-3 mb-2">
        {dotColor && (
          <span className={clsx('w-1.5 h-1.5', dotColor)} />
        )}
        <span className="text-text-muted text-[10px] font-bold uppercase tracking-widest">
          {title}
        </span>
        <span className="text-text-muted/50 text-[10px] font-mono ml-auto">{tasks.length}</span>
      </div>
      <div className="space-y-px">
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
    <aside className="fixed left-0 top-14 bottom-0 w-64 bg-surface border-r border-border overflow-y-auto z-20">
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
