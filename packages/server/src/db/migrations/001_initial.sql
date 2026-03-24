-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TASKS
-- ============================================
CREATE TYPE task_status AS ENUM (
  'queued',
  'planning',
  'awaiting_approval',
  'executing',
  'awaiting_review',
  'merging',
  'completed',
  'errored',
  'rejected'
);

CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TABLE tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  status          task_status NOT NULL DEFAULT 'queued',
  priority        task_priority NOT NULL DEFAULT 'medium',
  model_tier      TEXT NOT NULL DEFAULT 'default',
  target_branch   TEXT NOT NULL DEFAULT 'main',
  parent_task_id  UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);

-- ============================================
-- SLOTS (worktree pool)
-- ============================================
CREATE TYPE slot_status AS ENUM ('idle', 'claimed', 'active', 'cleaning', 'quarantined');

CREATE TABLE slots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_number     INTEGER NOT NULL UNIQUE,
  status          slot_status NOT NULL DEFAULT 'idle',
  worktree_path   TEXT NOT NULL,
  branch_name     TEXT,
  current_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  claimed_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- PLANS
-- ============================================
CREATE TYPE plan_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content           TEXT NOT NULL,
  file_manifest     JSONB NOT NULL DEFAULT '[]',
  reasoning         TEXT NOT NULL DEFAULT '',
  estimate          TEXT NOT NULL DEFAULT '',
  status            plan_status NOT NULL DEFAULT 'pending',
  reviewer_feedback TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at       TIMESTAMPTZ
);

CREATE INDEX idx_plans_task ON plans(task_id);
CREATE INDEX idx_plans_status ON plans(status);

-- ============================================
-- EVENTS (immutable append-only log)
-- ============================================
CREATE TYPE event_type AS ENUM (
  'task_created',
  'task_assigned',
  'plan_submitted',
  'plan_approved',
  'plan_rejected',
  'execution_started',
  'execution_progress',
  'agent_question',
  'execution_completed',
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
  'conflict_detected'
);

CREATE TABLE events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID REFERENCES tasks(id) ON DELETE CASCADE,
  slot_id     UUID REFERENCES slots(id) ON DELETE SET NULL,
  event_type  event_type NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_task ON events(task_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_created ON events(created_at DESC);

-- ============================================
-- FILE LOCKS (conflict detection)
-- ============================================
CREATE TABLE file_locks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_path   TEXT NOT NULL,
  lock_type   TEXT NOT NULL DEFAULT 'write',
  locked_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_file_locks_path ON file_locks(file_path);
CREATE INDEX idx_file_locks_task ON file_locks(task_id);
CREATE UNIQUE INDEX idx_file_locks_unique ON file_locks(file_path, task_id);

-- ============================================
-- DIFFS (stored for review)
-- ============================================
CREATE TABLE diffs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  diff_content  TEXT NOT NULL,
  files_changed JSONB NOT NULL DEFAULT '[]',
  additions     INTEGER NOT NULL DEFAULT 0,
  deletions     INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diffs_task ON diffs(task_id);

-- ============================================
-- RETROSPECTIVES
-- ============================================
CREATE TABLE retrospectives (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id               UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  summary               TEXT NOT NULL,
  files_changed         JSONB NOT NULL DEFAULT '[]',
  approaches_abandoned  JSONB NOT NULL DEFAULT '[]',
  uncertainties         JSONB NOT NULL DEFAULT '[]',
  duration_seconds      INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_retrospectives_task ON retrospectives(task_id);

-- ============================================
-- DAEMON REGISTRATION
-- ============================================
CREATE TABLE daemons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL DEFAULT 'default',
  repo_path       TEXT NOT NULL,
  pool_size       INTEGER NOT NULL DEFAULT 5,
  last_heartbeat  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT NOT NULL DEFAULT 'online',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- TRIGGER: auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER slots_updated_at BEFORE UPDATE ON slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
