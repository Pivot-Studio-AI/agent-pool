# Contributing to Agent Pool

Thanks for your interest in contributing to Agent Pool. This guide covers the basics you need to get started.

## Getting Started

1. **Clone the repo** and install dependencies:
   ```bash
   git clone <repo-url>
   cd agent-pool
   npm install
   ```

2. **Start PostgreSQL** using Docker Compose:
   ```bash
   docker compose up -d
   ```

3. **Set up environment variables** by copying the example config:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your local settings.

4. **Run database migrations:**
   ```bash
   npm run migrate -w packages/server
   ```

5. **Start development servers:**
   ```bash
   # Server
   npm run dev -w packages/server

   # Dashboard
   npm run dev -w packages/dashboard

   # Daemon (requires a valid REPO_PATH in .env)
   npm run dev -w packages/daemon
   ```

## Project Structure

Agent Pool is a monorepo with three packages:

- **`packages/server`** — Express REST API + WebSocket server + PostgreSQL
- **`packages/dashboard`** — React (Vite) SPA for task and review management
- **`packages/daemon`** — Local Node.js process that manages git worktrees and spawns Claude Code agents

See `CLAUDE.md` for the full architecture specification.

## Development Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b your-branch-name main
   ```

2. Make your changes, keeping commits focused and well-described.

3. Run tests before submitting:
   ```bash
   npm test -w packages/server
   npm test -w packages/daemon
   ```

4. Open a pull request against `main` with a clear description of what changed and why.

## Code Style

- **TypeScript** is used across all packages. Avoid `any` types.
- Use **default imports** (e.g., `import express from 'express'`, not `import * as express`).
- Keep functions small and focused. Prefer clarity over cleverness.
- Follow existing patterns in the codebase — consistency matters more than personal preference.

## Commit Messages

Write clear, concise commit messages that explain the **why**, not just the what. Use the imperative mood:

- `fix: handle merge conflicts when target branch is ahead`
- `feat: add file conflict warnings to plan review screen`
- `refactor: simplify slot claiming logic`

## Pull Requests

- Keep PRs focused on a single change. Smaller PRs get reviewed faster.
- Include a summary of what changed and the motivation behind it.
- If your change affects the UI, include a screenshot or brief description of the visual change.
- Make sure tests pass before requesting review.

## Reporting Issues

Open an issue on GitHub with:

- A clear title describing the problem
- Steps to reproduce (if it's a bug)
- Expected vs. actual behavior
- Relevant logs or screenshots

## Architecture Decisions

Major design decisions are documented in `CLAUDE.md`. If your contribution involves architectural changes, discuss them in an issue first before writing code.

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
