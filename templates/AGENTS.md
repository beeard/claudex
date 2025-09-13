# AGENTS: Orchestration Kit Template

Scope: All files under this `claudex/` directory when copied into a host project.

Guidelines
- Do not overwrite existing host scripts. Only add missing ones.
- Memory HTTP defaults to SQLite; Supabase is optional and can be enabled any time.
- Scripts must be portable across macOS and Linux.
- No absolute paths; use project-relative paths only.

Installation
- Run `node dist/claudex.cjs init` in the target repo.
- Review `.env` at `claudex/.env` and set tokens as needed.

