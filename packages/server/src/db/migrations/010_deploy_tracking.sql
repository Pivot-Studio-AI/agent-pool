-- Add deploy tracking fields to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deploy_status TEXT DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deploy_url TEXT DEFAULT NULL;

-- Add deploy_config to repositories for per-repo deploy configuration
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS deploy_config JSONB DEFAULT NULL;

-- Index for querying tasks by deploy status
CREATE INDEX IF NOT EXISTS idx_tasks_deploy_status ON tasks(deploy_status) WHERE deploy_status IS NOT NULL;
