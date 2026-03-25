-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id BIGINT UNIQUE NOT NULL,
  github_login TEXT NOT NULL,
  github_avatar_url TEXT,
  github_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Repositories table
CREATE TABLE repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_full_name TEXT UNIQUE NOT NULL,
  github_url TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_repositories_user ON repositories(user_id);

-- Add repo_id to existing tables (nullable for backward compat)
ALTER TABLE tasks ADD COLUMN repo_id UUID REFERENCES repositories(id) ON DELETE SET NULL;
ALTER TABLE daemons ADD COLUMN repo_id UUID REFERENCES repositories(id) ON DELETE SET NULL;
ALTER TABLE slots ADD COLUMN repo_id UUID REFERENCES repositories(id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_repo ON tasks(repo_id);
