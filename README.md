# happy-feed-journal

An app that records feed and food for babies, ai native and friendly. Enjoy baby growing up time.

A cross-platform (iOS / Android / web) app for logging baby feedings. Add
multiple babies, share a baby's data with the whole family, and log feedings by
voice (parsed into structured data by AI) or by filling in the form directly.

## Tech stack

- [Expo](https://expo.dev/) (React Native + TypeScript) with `expo-router`
- [Supabase](https://supabase.com/) — Postgres, Auth, Row-Level Security, Realtime
- Supabase Edge Function (`parse-feeding`) calling OpenAI (Whisper + LLM) to turn
  a voice clip / text note into a structured feeding entry

## Features

- Email/password auth; a profile is created automatically on sign-up
- Multiple families and multiple babies, with a switcher on the dashboard
- Family sharing via an invite code (anyone with the code can view/log data)
- Feeding kinds: breast milk, formula, solid food, snack
- Voice-first logging: speak (or type) -> AI extracts kind/food/amount/unit/time
- Manual structured entry as an always-available fallback
- Realtime timeline that updates live across family members

## Prerequisites

- Node.js 22+
- Docker (for the local Supabase stack)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

## Getting started

```bash
npm install
cp .env.example .env          # local Supabase URL + anon key
supabase start                # starts Postgres, Auth, Realtime, Edge Functions
npm run web                   # or: npx expo start  (then press i / a / w)
```

Open the printed URL (web defaults to http://localhost:8081). Sign up, create a
family, add a baby, and log a feeding.

### Enabling voice / AI parsing

The `parse-feeding` Edge Function needs an OpenAI key. Export it before starting
Supabase so the local Edge runtime can read it:

```bash
export OPENAI_API_KEY=sk-...
supabase start                # or `supabase stop && supabase start` if running
```

Without a key the function returns HTTP 501 and the app falls back to manual entry.

## Scripts

| Command         | Description                          |
| --------------- | ------------------------------------ |
| `npm run web`   | Start Expo for web                   |
| `npm run ios`   | Start Expo for iOS (requires macOS)  |
| `npm run android` | Start Expo for Android             |
| `npm run lint`  | Run ESLint                           |
| `npx tsc --noEmit` | Type-check                        |

## Project structure

- `src/app/**` — screens (expo-router): `sign-in`, `index` (dashboard), `add`, `family`
- `src/context/app-context.tsx` — session, families, baby selection
- `src/lib/**` — Supabase client, types, audio helpers
- `supabase/migrations/0001_init.sql` — schema, RLS, helper functions, realtime
- `supabase/functions/parse-feeding` — voice/text -> structured feeding (OpenAI)
