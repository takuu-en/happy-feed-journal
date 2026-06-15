# AGENTS.md

## Project overview

`happy-feed-journal` is a single Next.js 15 (App Router) + TypeScript application
for logging baby feedings. Persistence is local SQLite via `better-sqlite3`.
There is one service (the Next.js app); there is no separate backend.

## Cursor Cloud specific instructions

- Single service: the Next.js app. Run it with `npm run dev` (port 3000). Lint
  with `npm run lint`, build/type-check with `npm run build`. These are the
  standard scripts in `package.json`.
- `better-sqlite3` is a native module installed from a prebuilt binary during
  `npm install`. If you ever change the Node major version, reinstall so the
  native binary matches (`rm -rf node_modules && npm install`).
- The SQLite database is created automatically at `data/journal.db` on first
  request (the `data/` directory is gitignored). To reset all journal data,
  stop the dev server and delete the `data/` directory.
- The `/api/insights` endpoint works fully offline using a local message
  generator. It only calls OpenAI when `OPENAI_API_KEY` is set, and falls back
  to the local message on any error — so no secrets are required to run or test.
- API routes are marked `dynamic = "force-dynamic"` because they read the
  database at request time; do not expect them to be statically prerendered.
