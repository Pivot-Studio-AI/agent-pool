# AGENT POOL — Full Implementation Specification

> **This document is your complete build guide.** Read it fully before writing any code. Follow the phased implementation order exactly. Do not skip ahead. Each phase builds on the previous one and has explicit exit criteria.

---

## PRODUCT SUMMARY

Agent Pool is a personal AI development operations platform. It sits between a user and Claude Code, turning the experience of running multiple AI coding agents from terminal babysitting into team management.

**The core loop:** Describe a task → agent generates a plan → user approves or rejects the plan → agent builds in an isolated git worktree → user reviews the diff → user merges or rejects → worktree is cleaned up.

**The user:** A technical founder or senior developer who can read diffs and evaluate plans but wants to direct 5–10 concurrent AI coding workstreams instead of working in one terminal.

**The stack:**
- **Daemon:** Node.js process running on the user's machine. Manages git worktrees, spawns Claude Code CLI processes, communicates with the server.
- **Server:** Node.js (Express) with PostgreSQL. REST API + WebSocket. Serves the web dashboard.
- **Dashboard:** React (Vite) SPA. The primary interface for plan review, diff review, and task management.
- **Messaging bridge:** WhatsApp Business API / Telegram Bot API integration for notifications and quick actions.

---

## AGENT BEHAVIOR RULES

- ONLY modify files listed in your approved plan manifest. Do NOT touch any other files.
- Do NOT revert, "clean up", or modify existing code that is unrelated to your task.
- The codebase contains recent changes from other developers — leave them alone.
- Follow existing import patterns in each file (use default imports, e.g. `import multer from 'multer'`, not `import * as multer`).
- If you encounter code that looks wrong but is not part of your task, leave it.
- Implement ALL files listed in your plan. Do not skip planned files.

## DEPLOYMENT

- Server + dashboard auto-deploy via GitHub Actions on push to main.
- GitHub Actions runs `railway up` to deploy to Railway production.
- The daemon runs locally on the developer's machine and must be restarted manually after daemon code changes.
- After merge and push, the daemon monitors the GitHub Actions deploy and reports status.
- Task status flow: `merging` → `deploying` → `completed` (or `errored` if deploy fails).

---

## PROJECT STRUCTURE

```
agent-pool/
├── CLAUDE.md                          # This file
├── package.json                       # Root workspace config
├── docker-compose.yml                 # PostgreSQL + services
├── .env.example
│
├── packages/
│   ├── daemon/                        # Local daemon process
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts               # Entry point, daemon lifecycle
│   │   │   ├── config.ts              # Configuration loading
│   │   │   ├── worktree/
│   │   │   │   ├── pool.ts            # Worktree pool manager
│   │   │   │   ├── provision.ts       # Create/destroy worktrees
│   │   │   │   └── cleanup.ts         # Post-task worktree reset
│   │   │   ├── agent/
│   │   │   │   ├── spawner.ts         # Spawn Claude Code CLI processes
│   │   │   │   ├── monitor.ts         # Health checks, crash detection
│   │   │   │   ├── output-parser.ts   # Parse agent stdout for plans, questions, completion
│   │   │   │   └── plan-extractor.ts  # Extract structured plan from agent output
│   │   │   ├── server-client/
│   │   │   │   ├── api.ts             # REST client for server communication
│   │   │   │   └── poller.ts          # Poll server for new tasks
│   │   │   └── git/
│   │   │       ├── worktree.ts        # Git worktree commands
│   │   │       ├── branch.ts          # Branch management
│   │   │       ├── diff.ts            # Generate diffs for review
│   │   │       └── merge.ts           # Merge worktree branch into target
│   │   └── tests/
│   │
│   ├── server/                        # Central server (REST + WebSocket + DB)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts               # Express app entry
│   │   │   ├── config.ts
│   │   │   ├── db/
│   │   │   │   ├── connection.ts      # PostgreSQL connection pool
│   │   │   │   ├── migrations/        # SQL migration files (sequential)
│   │   │   │   │   ├── 001_initial.sql
│   │   │   │   │   └── ...
│   │   │   │   └── migrate.ts         # Migration runner
│   │   │   ├── routes/
│   │   │   │   ├── tasks.ts           # Task CRUD endpoints
│   │   │   │   ├── plans.ts           # Plan submission + approval
│   │   │   │   ├── slots.ts           # Slot status
│   │   │   │   ├── events.ts          # Event log / activity feed
│   │   │   │   ├── diffs.ts           # Diff retrieval
│   │   │   │   ├── merge.ts           # Merge approval
│   │   │   │   └── daemon.ts          # Daemon registration + heartbeat
│   │   │   ├── ws/
│   │   │   │   ├── server.ts          # WebSocket server setup
│   │   │   │   └── broadcast.ts       # Broadcast events to connected clients
│   │   │   ├── services/
│   │   │   │   ├── task-service.ts    # Task state machine logic
│   │   │   │   ├── slot-service.ts    # Slot claiming + release
│   │   │   │   ├── plan-service.ts    # Plan storage + approval flow
│   │   │   │   ├── event-service.ts   # Event logging
│   │   │   │   ├── diff-service.ts    # Diff storage + retrieval
│   │   │   │   ├── file-lock-service.ts   # Conflict detection
│   │   │   │   └── scheduler.ts       # Task scheduling + conflict checking
│   │   │   ├── messaging/
│   │   │   │   ├── whatsapp.ts        # WhatsApp Business API client
│   │   │   │   ├── telegram.ts        # Telegram Bot API client
│   │   │   │   ├── notifications.ts   # Notification formatting + routing
│   │   │   │   └── command-parser.ts  # Parse incoming message commands
│   │   │   └── middleware/
│   │   │       ├── auth.ts            # API key auth for daemon + dashboard
│   │   │       └── error-handler.ts
│   │   └── tests/
│   │
│   └── dashboard/                     # React SPA
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── index.html
│       ├── public/
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── api/
│           │   ├── client.ts          # HTTP client for server API
│           │   └── ws.ts              # WebSocket connection manager
│           ├── stores/
│           │   ├── task-store.ts      # Task state (zustand)
│           │   ├── event-store.ts     # Activity feed state
│           │   └── slot-store.ts      # Slot status state
│           ├── components/
│           │   ├── layout/
│           │   │   ├── Header.tsx
│           │   │   ├── Sidebar.tsx
│           │   │   └── Shell.tsx
│           │   ├── tasks/
│           │   │   ├── TaskInbox.tsx       # Primary task list view
│           │   │   ├── TaskCreator.tsx     # Quick task creation input
│           │   │   ├── TaskDetail.tsx      # Task detail router
│           │   │   └── TaskStatusBadge.tsx
│           │   ├── plan-review/
│           │   │   ├── PlanReview.tsx      # Plan review screen (HERO)
│           │   │   ├── PlanSummary.tsx     # Plan content display
│           │   │   ├── FileManifest.tsx    # Files the agent will touch
│           │   │   └── ApprovalControls.tsx
│           │   ├── diff-review/
│           │   │   ├── DiffReview.tsx      # Diff review screen (HERO)
│           │   │   ├── DiffViewer.tsx      # Syntax-highlighted diff
│           │   │   ├── FileTree.tsx        # File-by-file navigation
│           │   │   └── MergeControls.tsx
│           │   ├── activity/
│           │   │   ├── ActivityFeed.tsx    # Chronological event log
│           │   │   └── EventItem.tsx
│           │   ├── slots/
│           │   │   └── SlotIndicator.tsx   # Slot status dots in header
│           │   └── shared/
│           │       ├── Badge.tsx
│           │       ├── Button.tsx
│           │       ├── Card.tsx
│           │       └── CodeBlock.tsx
│           ├── hooks/
│           │   ├── useWebSocket.ts
│           │   ├── useTasks.ts
│           │   └── useSlots.ts
│           ├── styles/
│           │   └── globals.css
│           └── lib/
│               ├── types.ts           # Shared TypeScript types
│               └── constants.ts
```

---

## DATABASE SCHEMA

Use PostgreSQL. All timestamps are `timestamptz`. All IDs are `uuid` with `gen_random_uuid()` default.

### Migration 001: Initial Schema

```sql
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
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  file_manifest   JSONB NOT NULL DEFAULT '[]',
  reasoning       TEXT NOT NULL DEFAULT '',
  estimate        TEXT NOT NULL DEFAULT '',
  status          plan_status NOT NULL DEFAULT 'pending',
  reviewer_feedback TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ
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
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID REFERENCES tasks(id) ON DELETE CASCADE,
  slot_id         UUID REFERENCES slots(id) ON DELETE SET NULL,
  event_type      event_type NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_task ON events(task_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_created ON events(created_at DESC);

-- ============================================
-- FILE LOCKS (conflict detection)
-- ============================================
CREATE TABLE file_locks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_path       TEXT NOT NULL,
  lock_type       TEXT NOT NULL DEFAULT 'write',
  locked_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_file_locks_path ON file_locks(file_path);
CREATE INDEX idx_file_locks_task ON file_locks(task_id);
CREATE UNIQUE INDEX idx_file_locks_unique ON file_locks(file_path, task_id);

-- ============================================
-- DIFFS (stored for review)
-- ============================================
CREATE TABLE diffs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  diff_content    TEXT NOT NULL,
  files_changed   JSONB NOT NULL DEFAULT '[]',
  additions       INTEGER NOT NULL DEFAULT 0,
  deletions       INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diffs_task ON diffs(task_id);

-- ============================================
-- RETROSPECTIVES
-- ============================================
CREATE TABLE retrospectives (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  summary         TEXT NOT NULL,
  files_changed   JSONB NOT NULL DEFAULT '[]',
  approaches_abandoned JSONB NOT NULL DEFAULT '[]',
  uncertainties   JSONB NOT NULL DEFAULT '[]',
  duration_seconds INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
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
```

---

## API SPECIFICATION

Base URL: `/api/v1`

All responses follow `{ data: T }` for success and `{ error: { message: string, code: string } }` for errors.

Authentication: API key in `Authorization: Bearer <key>` header. Same key shared between daemon and dashboard (configured in `.env`).

### Tasks

```
POST   /tasks                    Create a task
GET    /tasks                    List tasks (query: ?status=queued,executing&limit=50)
GET    /tasks/:id                Get task detail
PATCH  /tasks/:id                Update task (status transitions, priority changes)
DELETE /tasks/:id                Cancel/delete a task (only if queued)
```

**POST /tasks body:**
```json
{
  "title": "Add rate limiting middleware",
  "description": "Implement token bucket rate limiting on all /api routes...",
  "priority": "high",
  "target_branch": "main",
  "model_tier": "default"
}
```

**PATCH /tasks/:id body (for status transitions):**
```json
{
  "status": "awaiting_approval",
  "reason": "Plan generated successfully"
}
```

### Plans

```
POST   /tasks/:id/plans          Submit a plan (daemon → server)
GET    /tasks/:id/plans           Get plans for a task
POST   /tasks/:id/plans/:planId/approve    Approve a plan (dashboard → server)
POST   /tasks/:id/plans/:planId/reject     Reject with feedback (dashboard → server)
```

**POST /tasks/:id/plans body (daemon submits):**
```json
{
  "content": "I will implement token bucket rate limiting using...",
  "file_manifest": ["src/middleware/rateLimit.ts", "src/config/limits.ts"],
  "reasoning": "Token bucket is preferred because...",
  "estimate": "4 files, ~180 lines"
}
```

**POST /tasks/:id/plans/:planId/reject body:**
```json
{
  "feedback": "Use sliding window instead of token bucket. We need smoother rate limiting."
}
```

### Diffs

```
POST   /tasks/:id/diffs           Submit a diff (daemon → server)
GET    /tasks/:id/diffs           Get diffs for a task
```

**POST /tasks/:id/diffs body:**
```json
{
  "diff_content": "diff --git a/src/middleware/rateLimit.ts...",
  "files_changed": [
    { "path": "src/middleware/rateLimit.ts", "additions": 45, "deletions": 0 },
    { "path": "src/config/limits.ts", "additions": 12, "deletions": 0 }
  ],
  "additions": 57,
  "deletions": 0
}
```

### Merge

```
POST   /tasks/:id/merge/approve   Approve merge (dashboard → server → daemon executes)
POST   /tasks/:id/merge/reject    Reject (abandon changes)
POST   /tasks/:id/review/request-changes   Send back with comments
```

**POST /tasks/:id/review/request-changes body:**
```json
{
  "comments": "The error handling in rateLimit.ts needs to return 429 with a Retry-After header."
}
```

### Events

```
GET    /events                    List events (query: ?task_id=X&type=plan_submitted&limit=100&before=<timestamp>)
```

### Slots

```
GET    /slots                     List all slots with current status
POST   /slots/:id/claim           Claim a slot (daemon → server, atomic)
POST   /slots/:id/release         Release a slot (daemon → server)
```

**POST /slots/:id/claim body:**
```json
{
  "task_id": "uuid-of-task",
  "daemon_id": "uuid-of-daemon"
}
```

### Daemon

```
POST   /daemon/register           Register a daemon instance
POST   /daemon/heartbeat          Heartbeat (every 30s)
```

### File Locks

```
POST   /file-locks                Acquire locks (daemon → server)
DELETE /file-locks?task_id=X      Release all locks for a task
GET    /file-locks/check          Check for conflicts before assignment
```

**POST /file-locks body:**
```json
{
  "task_id": "uuid",
  "files": ["src/middleware/rateLimit.ts", "src/config/limits.ts"]
}
```

**GET /file-locks/check?files=src/middleware/rateLimit.ts,src/config/limits.ts**
Returns any existing locks on those files by other tasks.

---

## WEBSOCKET PROTOCOL

The server runs a WebSocket server on the same port as HTTP (upgrade on `/ws`).

### Client → Server Messages

```json
{ "type": "subscribe", "channels": ["tasks", "events", "slots"] }
{ "type": "unsubscribe", "channels": ["events"] }
```

### Server → Client Messages

All messages follow:
```json
{
  "type": "event_type_string",
  "data": { ... },
  "timestamp": "ISO-8601"
}
```

Event types broadcast over WebSocket:
- `task.created` — new task added
- `task.updated` — task status changed
- `plan.submitted` — plan ready for review
- `plan.reviewed` — plan approved or rejected
- `execution.progress` — agent progress update
- `execution.completed` — agent finished building
- `diff.ready` — diff available for review
- `merge.completed` — code merged
- `merge.failed` — merge failed
- `slot.updated` — slot status changed
- `event.new` — new event in activity feed

The dashboard connects on load and subscribes to all channels. Each broadcast includes enough data to update the UI without a follow-up REST call.

---

## DAEMON BEHAVIOR SPECIFICATION

The daemon is the most critical component. It must be reliable, recover from crashes, and never lose state.

### Startup Sequence

1. Read config (repo path, pool size, server URL, API key).
2. Validate: is this a git repository? Is the server reachable?
3. Register with the server (`POST /daemon/register`).
4. Provision worktrees: for each slot 1..N, check if the worktree exists. Create it if not. Register the slot with the server.
5. Start the polling loop.
6. Start the heartbeat loop (every 30s).

### Polling Loop (every 3 seconds)

1. `GET /tasks?status=queued&limit=1` — check for queued tasks (highest priority first).
2. `GET /slots?status=idle` — check for free slots.
3. If both exist: attempt to claim the slot (`POST /slots/:id/claim`). If the claim succeeds (atomic, no race condition), proceed.
4. Before assignment, check file conflicts: `GET /file-locks/check` with the task's expected file paths (if known from a prior decomposition) or skip if unknown.
5. Update task status to `planning`.
6. Spawn agent.

### Agent Lifecycle

When a task is assigned to a slot:

1. **Prepare worktree:** `git checkout` the target branch in the worktree. `git pull` to ensure it's current. Create a task-specific branch: `agent-pool/task-<short-id>`.
2. **Spawn Claude Code:** Run `claude` CLI in the worktree directory with the task prompt. The prompt includes:
   - The task description
   - The content of CLAUDE.md from the repo root (if it exists)
   - Instructions to first output a plan, then wait for approval before writing code
   - Any feedback from a prior rejected plan (if this is a retry)
3. **Plan extraction:** Parse the agent's output for the plan. The agent is instructed to output the plan in a structured format (markdown with specific headers). The daemon extracts: summary, file manifest, reasoning, estimate.
4. **Submit plan:** `POST /tasks/:id/plans` — sends the plan to the server. Update task status to `awaiting_approval`. Pause the agent (keep process alive but don't send further input).
5. **Wait for approval:** Poll `GET /tasks/:id/plans` until the latest plan status is `approved` or `rejected`.
   - If **approved**: send a message to the agent's stdin indicating approval. The agent begins writing code. Update task status to `executing`. Acquire file locks for the files in the plan's manifest.
   - If **rejected with feedback**: send the feedback to the agent's stdin. The agent generates a new plan. Return to step 3.
6. **Execution monitoring:** Stream the agent's stdout to the server as `execution_progress` events. Check process health every 10 seconds.
7. **Completion:** When the agent finishes (process exits successfully):
   - Generate diff: `git diff <target-branch>...<task-branch>` in the worktree.
   - Submit diff: `POST /tasks/:id/diffs`.
   - Update task status to `awaiting_review`.
8. **Review handling:** Poll for review decision.
   - If **approved for merge**: execute merge (see below). Update status to `merging`.
   - If **changes requested**: re-spawn or send comments to agent. Return to step 6.
   - If **rejected**: clean up, update status to `rejected`.
9. **Merge execution:**
   - In the worktree: `git checkout <target-branch> && git merge --no-ff <task-branch>`.
   - If merge conflict: report the conflict as a `merge_failed` event. Update task status to `errored`. Do NOT attempt auto-resolution.
   - If successful: `git push origin <target-branch>`. Update task status to `completed`.
10. **Cleanup:** Delete the task branch. Reset worktree to clean state. Release file locks. Release the slot (`POST /slots/:id/release`).

### Error Handling

- If the Claude Code process crashes: mark task as `errored`, log the error, release the slot.
- If the server is unreachable: buffer events locally and retry. Never lose state.
- If a worktree is corrupted: quarantine the slot, alert via event, don't use it for new tasks.

### Claude Code CLI Interaction

The daemon spawns Claude Code using the CLI:

```bash
claude --dangerously-skip-permissions \
  --output-format stream-json \
  --max-turns 50 \
  --model <model> \
  -p "<prompt>"
```

The `stream-json` output format gives structured JSON messages on stdout that the daemon can parse for:
- Plan content (agent's first response before writing code)
- Progress updates (tool use, file edits)
- Questions (agent asking for clarification)
- Completion signals

**The prompt template for plan generation:**

```
You are an AI coding agent working on a task. Your working directory is a git worktree.

TASK: {task.title}
DESCRIPTION: {task.description}

{claude_md_content if exists}

INSTRUCTIONS:
1. First, analyze the codebase and generate a PLAN. Output your plan using this exact format:

## Plan
[Your approach summary — 2-3 sentences]

## Files to Modify
- path/to/file1.ts
- path/to/file2.ts

## Reasoning
[Why this approach, what alternatives you considered]

## Estimate
[Number of files, approximate lines of code]

2. STOP after outputting the plan. Do not write any code yet. Wait for approval.
3. If your plan is approved, you will receive "PLAN APPROVED. Proceed with implementation."
4. If your plan is rejected, you will receive feedback. Generate a new plan incorporating the feedback.

{rejection_feedback if retry: "PREVIOUS PLAN REJECTED. Feedback: {feedback}. Generate a new plan."}
```

**The approval message sent to stdin:**
```
PLAN APPROVED. Proceed with implementation. Write the code now.
```

**The rejection message sent to stdin:**
```
PLAN REJECTED. Feedback: {feedback}. Generate a revised plan using the same format as before.
```

**The changes-requested message (post-review):**
```
CHANGES REQUESTED. The following feedback was provided on your code:
{comments}
Please make the requested changes.
```

---

## DASHBOARD SPECIFICATION

### Tech Stack
- React 18+ with TypeScript
- Vite for bundling
- Zustand for state management
- TailwindCSS for styling
- `diff2html` for diff rendering with syntax highlighting
- `lucide-react` for icons
- Native WebSocket API (no socket.io needed)

### Design Language

The dashboard uses a dark theme inspired by terminal/IDE aesthetics. This is an engineering tool, not a marketing page.

- **Background:** `#0a0c10` (near-black)
- **Surface:** `#161b22` (cards, panels)
- **Border:** `#21262d`
- **Text primary:** `#e6edf3`
- **Text secondary:** `#8b949e`
- **Text muted:** `#484f58`
- **Accent blue:** `#58a6ff` (links, selected states)
- **Green:** `#3fb950` (success, executing, additions)
- **Yellow/amber:** `#d29922` (attention needed, warnings)
- **Red:** `#f85149` (errors, deletions, rejections)
- **Purple:** `#8957e5` (merge, completed)
- **Font:** `JetBrains Mono` for everything (monospace). Load from Google Fonts.

### Layout

Three-column layout:
1. **Header** (fixed top): Logo left, task input center, slot indicators right.
2. **Sidebar** (fixed left, 260px): Task list grouped by status.
3. **Content** (remaining space): Active view based on selection.

### Views

#### Overview (default, no task selected)
Shows:
- Stats row: tasks needing attention count, actively building count, slots in use, today's completed count.
- "Needs Your Attention" section: cards for each task in `awaiting_approval` or `awaiting_review`. Click opens the task.
- "Recent Activity" section: last 5 events from the activity feed.

#### Plan Review View (task status = `awaiting_approval`)
**This is the most important screen in the product.** It must feel like reviewing a plan from a junior developer.
Shows:
- Task title, priority badge, status badge, metadata (slot, model, time).
- **Approach** block: the agent's summary of what it will do.
- **Reasoning** block: why it chose this approach.
- **Files to Modify** list: each file path with an icon. If any file has an active lock from another task, show a red conflict warning badge.
- **Estimate** block: scope estimate.
- **Action buttons:** "Approve Plan" (green), "Reject with Feedback" (red outline). Reject opens a textarea for feedback.

#### Diff Review View (task status = `awaiting_review`)
**The second most important screen.** It must feel like reviewing a pull request.
Shows:
- Task title, metadata.
- Stats row: files changed, total additions (green), total deletions (red).
- File list: each file with its addition/deletion counts. Click a file to scroll to its diff.
- Diff viewer: full unified diff with syntax highlighting. Use `diff2html` library configured for side-by-side or inline view (toggle). Line numbers. Color-coded additions/deletions.
- **Action buttons:** "Approve & Merge" (purple), "Request Changes" (default, opens textarea), "Reject" (red outline).

#### Executing View (task status = `executing`)
Shows:
- Task title, metadata, elapsed time.
- Live progress: the latest progress message from the agent, updating in real-time via WebSocket.
- A loading/spinner animation.

#### Queued View (task status = `queued`)
Shows:
- Task title, metadata.
- Queue position and estimated wait.

#### Activity Feed View (separate tab)
Shows:
- Full chronological event log.
- Each event: timestamp, colored dot by event type, description text.
- Filterable by event type and task.
- Scrollable with infinite scroll loading older events.

### Sidebar

The sidebar lists all active and recent tasks, grouped into sections:
1. **Needs Attention** (amber dot): `awaiting_approval` and `awaiting_review` tasks.
2. **In Progress** (green dot): `executing` tasks with elapsed time.
3. **Queued**: `queued` tasks with queue position.
4. **Recent**: last 10 completed/rejected/errored tasks.

Clicking a task in the sidebar loads its detail view in the content area.

### Task Creation

A persistent text input in the header bar. Type a description, press Enter. Sends `POST /tasks` with default priority `medium` and default target branch `main`.

Optionally expandable (click a chevron) to reveal: priority selector, target branch input, model tier selector, longer description textarea.

### Real-Time Updates

On initial load:
1. Connect WebSocket to `/ws`.
2. Subscribe to all channels.
3. Fetch initial state: `GET /tasks`, `GET /slots`, `GET /events?limit=20`.

On WebSocket message:
- `task.created`: add to task list, update counts.
- `task.updated`: update task in list, potentially move between sidebar sections.
- `plan.submitted`: if the task is currently viewed, load the plan. Show notification badge on sidebar item.
- `execution.progress`: if the task is currently viewed, update the progress message.
- `diff.ready`: if the task is currently viewed, load the diff.
- `slot.updated`: update slot indicators in header.
- `event.new`: prepend to activity feed.

### Notifications (In-Dashboard)

When a task transitions to `awaiting_approval` or `awaiting_review` and the user is not currently viewing that task, show a subtle toast notification at the bottom-right: "{task title} — plan ready for review" / "{task title} — diff ready for review". Clicking the toast navigates to the task.

---

## MESSAGING BRIDGE SPECIFICATION

### WhatsApp (Primary)

Uses the WhatsApp Business API (cloud-hosted). Requires:
- A Meta Business account and WhatsApp Business API access.
- A phone number registered with WhatsApp Business.
- Configuration: `WHATSAPP_PHONE_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN` in `.env`.

**Webhook endpoint:** `POST /api/v1/messaging/whatsapp/webhook` (receives incoming messages).
**Webhook verification:** `GET /api/v1/messaging/whatsapp/webhook` (Meta verification handshake).

**Outbound notifications (server → WhatsApp):**

The server sends WhatsApp messages when:
- A plan is ready for review: "📋 *Plan Ready*\n{task.title}\n\nApproach: {plan.content (truncated to 200 chars)}\nFiles: {file_manifest.length} files\n\nReply APPROVE or REJECT [feedback]"
- A diff is ready for review: "🔍 *Review Ready*\n{task.title}\n\n+{additions} −{deletions} across {files.length} files\n\nReply MERGE, REJECT, or view at {dashboard_url}/tasks/{id}"
- An agent has a question: "❓ *Agent Question*\n{task.title}\n\n{question}\n\nReply with your answer."
- A task errored: "❌ *Task Failed*\n{task.title}\n\n{error_summary}"
- A merge completed: "✅ *Merged*\n{task.title}\n\n+{additions} −{deletions} merged to {target_branch}"

**Inbound commands (WhatsApp → server):**

Users can send messages to the WhatsApp number:
- Free-form text: creates a new task with the message as description.
- `APPROVE` (in reply to a plan notification): approves the plan.
- `REJECT <feedback>` (in reply to a plan notification): rejects with feedback.
- `MERGE` (in reply to a diff notification): approves the merge.
- `STATUS`: returns a summary of all active tasks.
- `QUEUE`: returns the current queue.

Reply threading: WhatsApp messages include a `context.message_id` when replying. The server tracks which notification corresponds to which task so it can route replies correctly.

### Telegram (Secondary)

Uses the Telegram Bot API with long polling (no webhook needed, no public IP required).

Same notification format adapted for Telegram markdown. Same command set. Telegram's inline keyboards can be used for approve/reject buttons instead of text commands.

---

## CONFLICT DETECTION SPECIFICATION

This is the system that prevents two agents from editing the same file simultaneously.

### How It Works

1. **Plan submission:** When a plan is submitted, it includes a `file_manifest` — the list of files the agent intends to modify.
2. **Lock check:** Before the plan is shown to the user for approval, the server checks the `file_locks` table for any active locks on those files by other tasks.
3. **Conflict warning:** If conflicts exist, the plan review screen shows a warning: "⚠ {file_path} is currently being modified by task '{other_task.title}'. Approving this plan may cause merge conflicts."
4. **Lock acquisition:** When a plan is approved and the agent begins execution, the server acquires write locks on all files in the manifest.
5. **Lock release:** When a task completes, errors, or is rejected, all its file locks are released.

### Scheduler Behavior

The scheduler (in `scheduler.ts`) implements this ordering:
1. Get the highest-priority queued task.
2. If the task has a known file manifest (from a prior decomposition or the user specified files), check for conflicts.
3. If conflicts exist: skip this task, try the next one. The conflicting task stays in queue.
4. If no conflicts: assign to a free slot.
5. If no tasks can be assigned due to conflicts: do nothing, wait for active tasks to complete.

This means the scheduler naturally serializes tasks that touch the same files while parallelizing tasks that touch different files.

---

## IMPLEMENTATION PHASES

Build in this exact order. Do not skip ahead. Each phase must work completely before starting the next.

### Phase 1: Database + Server Core (build first)

1. Set up the monorepo with `packages/daemon`, `packages/server`, `packages/dashboard`.
2. Docker compose with PostgreSQL.
3. Run migration 001.
4. Implement the server: Express app, database connection, all REST routes, WebSocket server.
5. Write tests for every service (task state machine transitions are critical — test every valid and invalid transition).
6. **Exit criteria:** You can create tasks, submit plans, approve/reject plans, submit diffs, approve merges, and query events entirely through the REST API using curl.

### Phase 2: Dashboard MVP (build second)

1. Vite + React + TypeScript + TailwindCSS setup.
2. API client and WebSocket connection manager.
3. Zustand stores for tasks, events, slots.
4. Shell layout: header, sidebar, content area.
5. Task inbox / overview screen.
6. Plan review screen with approve/reject.
7. Diff review screen with syntax highlighting (use `diff2html`).
8. Activity feed.
9. Task creation input.
10. Slot indicators.
11. Real-time updates via WebSocket.
12. **Exit criteria:** You can manage the full task lifecycle through the dashboard: create a task, see it appear, review a (manually submitted) plan, approve it, review a (manually submitted) diff, merge it.

### Phase 3: Daemon (build third)

1. Config loading and validation.
2. Git worktree provisioning.
3. Server registration and heartbeat.
4. Polling loop.
5. Claude Code CLI spawning with the plan-first prompt.
6. Plan extraction from agent output.
7. Plan submission to server.
8. Approval polling and agent communication (send approval/rejection to stdin).
9. Diff generation and submission.
10. Merge execution.
11. Worktree cleanup and slot release.
12. Error handling (agent crash, server unreachable, corrupt worktree).
13. File lock acquisition and release.
14. **Exit criteria:** You can create a task in the dashboard, have the daemon pick it up, the agent generates a plan, you approve it in the dashboard, the agent writes code, you review the diff, approve the merge, and the code is merged. End to end.

### Phase 4: Messaging Bridge (build fourth)

1. WhatsApp webhook endpoint and verification.
2. Outbound notification sending.
3. Inbound command parsing (approve, reject, merge, status).
4. Reply threading (match incoming replies to the correct task).
5. Telegram bot with long polling.
6. Telegram inline keyboards for approve/reject buttons.
7. **Exit criteria:** You receive a WhatsApp notification when a plan is ready, reply "APPROVE", and the agent proceeds. You receive a notification when the diff is ready, reply "MERGE", and the code merges.

---

## CONFIGURATION

All configuration lives in `.env` at the project root.

```env
# Database
DATABASE_URL=postgresql://agentpool:agentpool@localhost:5432/agentpool

# Server
PORT=3000
API_KEY=your-secret-api-key-here
DASHBOARD_URL=http://localhost:5173

# Daemon
REPO_PATH=/path/to/your/repo
POOL_SIZE=5
SERVER_URL=http://localhost:3000
POLL_INTERVAL_MS=3000
DEFAULT_MODEL=claude-sonnet-4-20250514
DEFAULT_BRANCH=main

# WhatsApp
WHATSAPP_PHONE_ID=your-phone-id
WHATSAPP_ACCESS_TOKEN=your-access-token
WHATSAPP_VERIFY_TOKEN=your-verify-token
WHATSAPP_USER_PHONE=your-phone-number

# Telegram
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

Docker compose:

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: agentpool
      POSTGRES_PASSWORD: agentpool
      POSTGRES_DB: agentpool
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

---

## CRITICAL IMPLEMENTATION NOTES

### Task State Machine

The task state machine MUST be enforced at the database/service level. Invalid transitions must throw errors. The valid transitions are:

```
queued → planning
planning → awaiting_approval
awaiting_approval → planning (rejected, retry)
awaiting_approval → executing (approved)
awaiting_approval → rejected (user rejects permanently)
executing → awaiting_review (agent finished)
executing → errored (agent crashed)
awaiting_review → merging (user approves merge)
awaiting_review → executing (user requests changes)
awaiting_review → rejected (user rejects permanently)
merging → completed (merge succeeded)
merging → errored (merge failed)
```

Any transition not in this list is invalid. The `task-service.ts` must validate transitions.

### Slot Claiming Must Be Atomic

Use `SELECT ... FOR UPDATE SKIP LOCKED`:

```sql
UPDATE slots
SET status = 'claimed', current_task_id = $1, claimed_at = now()
WHERE id = (
  SELECT id FROM slots
  WHERE status = 'idle'
  ORDER BY slot_number
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

This prevents race conditions when multiple daemon polling cycles overlap.

### WebSocket Reconnection

The dashboard WebSocket client must:
- Reconnect automatically on disconnect (exponential backoff: 1s, 2s, 4s, 8s, max 30s).
- On reconnect: re-subscribe to all channels and fetch current state to sync.
- Show a "Reconnecting..." indicator in the header when disconnected.

### Diff Generation

Use `git diff --no-color <target_branch>...<task_branch>` to generate the diff. Parse the output to extract per-file stats (additions, deletions). Store the raw diff text and the parsed file stats separately.

For the dashboard, use the `diff2html` library to render the diff with syntax highlighting. Configure it in side-by-side mode as default with a toggle for inline mode.

### Agent Output Parsing

Claude Code with `--output-format stream-json` outputs JSON objects on stdout, one per line. Each object has a `type` field. The daemon must parse these to detect:

- `assistant` messages (the agent's text output — look for plan content here)
- `tool_use` events (the agent using tools — indicates it's writing code)
- `result` (the agent has finished)

The plan extractor should look for the structured plan format in the agent's text output (the headers: `## Plan`, `## Files to Modify`, `## Reasoning`, `## Estimate`).

### Error Recovery

The daemon must handle these failure modes gracefully:
1. **Server unreachable:** Buffer events locally (in-memory queue, max 1000). Retry every `POLL_INTERVAL_MS`. Once reconnected, flush the buffer.
2. **Agent crash:** Set task to `errored`, release slot, log the error with the last N lines of agent output.
3. **Corrupt worktree:** Run `git status` and `git stash` to attempt recovery. If that fails, delete and re-provision the worktree. Set slot to `quarantined` if re-provisioning fails.
4. **Database connection lost:** The server uses a connection pool with automatic reconnection. All database operations use retries (3 attempts with 1s backoff).

---

## DEPENDENCIES

### Server (`packages/server/package.json`)
```json
{
  "dependencies": {
    "express": "^4.18",
    "pg": "^8.12",
    "ws": "^8.16",
    "cors": "^2.8",
    "dotenv": "^16.4",
    "uuid": "^9.0",
    "zod": "^3.22"
  },
  "devDependencies": {
    "typescript": "^5.4",
    "tsx": "^4.7",
    "@types/express": "^4.17",
    "@types/pg": "^8.11",
    "@types/ws": "^8.5",
    "@types/cors": "^2.8",
    "vitest": "^1.4"
  }
}
```

### Dashboard (`packages/dashboard/package.json`)
```json
{
  "dependencies": {
    "react": "^18.3",
    "react-dom": "^18.3",
    "zustand": "^4.5",
    "diff2html": "^3.4",
    "lucide-react": "^0.383",
    "clsx": "^2.1"
  },
  "devDependencies": {
    "typescript": "^5.4",
    "vite": "^5.2",
    "@vitejs/plugin-react": "^4.2",
    "tailwindcss": "^3.4",
    "postcss": "^8.4",
    "autoprefixer": "^10.4",
    "@types/react": "^18.3",
    "@types/react-dom": "^18.3"
  }
}
```

### Daemon (`packages/daemon/package.json`)
```json
{
  "dependencies": {
    "dotenv": "^16.4",
    "zod": "^3.22"
  },
  "devDependencies": {
    "typescript": "^5.4",
    "tsx": "^4.7",
    "vitest": "^1.4"
  }
}
```

---

## WHAT NOT TO BUILD

- No authentication system beyond a shared API key. This is a single-user product in Phase 1.
- No user accounts, registration, or login.
- No file editor. The dashboard shows diffs, not an editor.
- No CI/CD integration. Agent Pool merges code. Deployment is the user's problem.
- No project management features. No epics, sprints, or estimates.
- No mobile app. WhatsApp is the mobile interface.
- No support for non-Claude Code agents.
- No code syntax AST analysis for conflict detection. File-path-level locking only in Phase 1.
