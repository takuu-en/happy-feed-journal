# AGENTS.md

## Project overview

`happy-feed-journal` is a cross-platform Expo (React Native + TypeScript) app for
logging baby feedings, backed by Supabase (Postgres + Auth + RLS + Realtime).
Voice/text notes are turned into structured feedings by the `parse-feeding`
Supabase Edge Function (OpenAI Whisper + LLM).

Standard commands live in `package.json` (`web`, `ios`, `android`, `lint`) and
`README.md`. Schema/RLS is in `supabase/migrations/0001_init.sql`.

## Cursor Cloud specific instructions

### Services and how to run them
- Supabase local stack (Postgres/Auth/Realtime/Edge Functions): `supabase start`.
  Requires the Docker daemon to be running. `supabase start` auto-serves the
  Edge Functions in `supabase/functions/` and applies `supabase/migrations/`.
  Get local URLs/keys with `supabase status`; reset the DB with `supabase db reset`.
- Expo app: `npm run web` (web target, port 8081) or `npx expo start`. The app
  reads `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` from `.env`.

### Non-obvious setup caveats
- `.env` is gitignored. Create it once with `cp .env.example .env` — the
  committed example already contains the deterministic local Supabase URL and
  anon key (these local-dev keys are public, not secrets).
- Docker daemon: this VM has no systemd. If `docker ps` fails, start the daemon
  manually (e.g. `sudo dockerd &`) and ensure the socket is usable
  (`sudo chmod 666 /var/run/docker.sock`) before `supabase start`.
- Docker 29 + this VM's kernel requires fuse-overlayfs with the containerd
  snapshotter disabled. `/etc/docker/daemon.json` is already configured with
  `storage-driver: fuse-overlayfs` and `features.containerd-snapshotter: false`;
  do not remove that or Docker will fail to start.
- iOS: a native iOS build needs macOS/Xcode and cannot be produced in this Linux
  VM. Test via the web target here; use Expo Go / EAS for on-device iOS/Android.
  iOS UX concerns (safe-area insets, keyboard avoidance, status bar, autofill,
  decimal keypads) live in the screens under `src/app/`; verify layout changes at
  an iPhone viewport on web (Chrome device toolbar) since the simulator is
  unavailable here.
- On-device iOS/Android cannot reach `127.0.0.1`; point
  `EXPO_PUBLIC_SUPABASE_URL` at a LAN IP or hosted project (the Simulator can use
  localhost). iOS bundle id: `com.happyfeed.journal`.

### Voice / AI (parse-feeding) function
- It needs `OPENAI_API_KEY`. Export it BEFORE `supabase start` so the local Edge
  runtime injects it (wired via `[edge_runtime.secrets]` in `supabase/config.toml`).
  If you start Supabase, then set the key, run `supabase stop && supabase start`.
- Without the key the function returns HTTP 501 by design and the app still works
  via manual feeding entry. Set `OPENAI_MODEL` to override the default model.

### Data model / RLS notes
- Access is scoped by `family_members`. Membership checks use SECURITY DEFINER
  helpers (`is_family_member`, `can_access_baby`) to avoid RLS recursion.
- Tables need explicit `GRANT`s to the `authenticated` role in addition to RLS
  policies (already in the migration) — RLS alone is not sufficient for access.
- `feedings` and `babies` are in the `supabase_realtime` publication; the
  dashboard subscribes to `feedings` changes for live updates.

### Lint
- The experimental `react-hooks/set-state-in-effect` rule is intentionally
  disabled in `eslint.config.js` because the app loads data from Supabase inside
  effects (setState runs after the awaited fetch). Keep data-loading effects;
  this is expected.
