# Creators Cockpit

Find Your Vertical — public creator vertical assessment tool + agency management workspace for OFManager.com's creator pipeline.

## Architecture

Two surfaces in one app:

- **Public** (`/`, `/report/:slug`) — creator-facing assessment wizard with scoring engine and shareable brand strategy reports
- **Cockpit** (`/cockpit`) — authenticated agency workspace for creator pipeline management, status tracking, and portfolio oversight

## Stack

- React 19 + Vite 6 + TypeScript
- Tailwind CSS v4
- Supabase (Mgrnz-web project: `jqfodlzcsgfocyuawzyx`)
- React Router v7 (hash-free browser routing)
- Deploy target: Cloudflare Workers (Wrangler)

## Setup

```bash
cp .env.example .env
# Fill in VITE_SUPABASE_ANON_KEY from Supabase project settings
npm install
npm run dev
```

## Database

Migrations live in `supabase/migrations/`. Run them against the Mgrnz-web Supabase project.

Tables:
- `creator_profiles` — primary entity
- `creator_assessments` — responses + scores
- `creator_reports` — generated brand strategy reports
- `creator_notes` — agency notes
- `creator_status_events` — lifecycle audit trail

All tables have RLS enabled. Creator creation is public (anon assessment flow); read/write on all other tables is authenticated (agency users only).

## Creator Lifecycle

prospect → assessed → qualified → interviewed → accepted → onboarding → active → (paused) → offboarded

## Deployment

```bash
npm run build
npm run deploy
```

Deploys to Cloudflare Workers as `findyourvertical`.

## Project Structure

```
src/
├── components/
│   ├── wizard/        # Public assessment wizard
│   ├── report/        # Public report page
│   └── cockpit/       # Agency workspace (auth-gated)
├── lib/
│   ├── supabase.ts    # Supabase client
│   ├── scoring.ts     # Scoring engine + archetype classifier
│   └── creators-api.ts # All API calls
├── types/
│   └── creator.ts     # Domain types
├── App.tsx            # Route definitions
└── main.tsx           # Entry point
```
