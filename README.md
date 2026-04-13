# Agent Pool

A personal AI development operations platform that turns running multiple Claude Code agents from terminal babysitting into team management.

## How It Works

1. **Describe a task** — type what you need built
2. **Review the plan** — the agent analyzes the codebase and proposes an approach
3. **Approve or reject** — give feedback like you would to a junior developer
4. **Agent builds** — code is written in an isolated git worktree
5. **Review the diff** — inspect changes like a pull request
6. **Merge or reject** — approved code merges into your target branch

Run 5–10 concurrent AI coding workstreams from a single dashboard.

## Architecture

| Component | Description |
|-----------|-------------|
| **Daemon** | Node.js process on your machine. Manages git worktrees, spawns Claude Code CLI processes, communicates with the server. |
| **Server** | Node.js (Express) with PostgreSQL. REST API + WebSocket. |
| **Dashboard** | React (Vite) SPA for plan review, diff review, and task management. |
| **Messaging** | WhatsApp / Telegram integration for notifications and quick actions. |

## Getting Started

### Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)
- Claude Code CLI

### Setup

```bash
# Install dependencies
npm install

# Start PostgreSQL
docker compose up -d

# Copy environment config
cp .env.example .env
# Edit .env with your settings

# Run database migrations
npm run migrate -w packages/server

# Start the server
npm run dev -w packages/server

# Start the dashboard
npm run dev -w packages/dashboard

# Start the daemon
npm run dev -w packages/daemon
```

## Configuration

All configuration lives in `.env` at the project root. See `.env.example` for available options.

## License

MIT
