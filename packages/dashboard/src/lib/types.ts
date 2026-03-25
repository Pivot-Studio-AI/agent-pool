export type TaskStatus = 'queued' | 'planning' | 'awaiting_approval' | 'executing' | 'awaiting_review' | 'merging' | 'completed' | 'errored' | 'rejected' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type PlanStatus = 'pending' | 'approved' | 'rejected';
export type SlotStatus = 'idle' | 'claimed' | 'active' | 'cleaning' | 'quarantined';
export type EventType = 'task_created' | 'task_assigned' | 'plan_submitted' | 'plan_approved' | 'plan_rejected' | 'execution_started' | 'execution_progress' | 'agent_question' | 'execution_completed' | 'diff_ready' | 'review_approved' | 'review_rejected' | 'review_changes_requested' | 'merge_started' | 'merge_completed' | 'merge_failed' | 'task_completed' | 'task_errored' | 'task_rejected' | 'task_cancelled' | 'slot_claimed' | 'slot_released' | 'conflict_detected';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  model_tier: string;
  target_branch: string;
  parent_task_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Plan {
  id: string;
  task_id: string;
  content: string;
  file_manifest: string[];
  reasoning: string;
  estimate: string;
  status: PlanStatus;
  reviewer_feedback: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface Diff {
  id: string;
  task_id: string;
  diff_content: string;
  files_changed: { path: string; additions: number; deletions: number }[];
  additions: number;
  deletions: number;
  review_feedback: string | null;
  summary: string | null;
  compliance: Record<string, unknown> | null;
  audit: {
    bugs: string[];
    security: string[];
    testing: string[];
    quality: string[];
    verdict: 'pass' | 'concerns' | 'fail';
  } | null;
  created_at: string;
}

export interface Slot {
  id: string;
  slot_number: number;
  status: SlotStatus;
  worktree_path: string;
  branch_name: string | null;
  current_task_id: string | null;
  claimed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppEvent {
  id: string;
  task_id: string | null;
  slot_id: string | null;
  event_type: EventType;
  payload: Record<string, any>;
  created_at: string;
}

export interface WSMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface User {
  id: string;
  github_login: string;
  github_avatar_url: string;
}

export interface Repository {
  id: string;
  github_full_name: string;
  github_url: string;
  default_branch: string;
  user_id: string;
  created_at: string;
}

export interface GithubRepo {
  id: number;
  full_name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
  description: string | null;
}
