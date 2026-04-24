# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project Overview

**Prode 2026** is a World Cup (FIFA 2026) prediction game. Users authenticate via Google, submit match predictions across group stages and knockout rounds, join private groups, and compete on a points-based leaderboard.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Run production server
npm run lint     # ESLint
```

No test framework is configured.

## Environment Variables

Create a `.env.local` with:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Architecture

All backend logic goes through Supabase — there are no custom API routes (`/app/api/`). Every page is a client component (`"use client"`) that queries Supabase directly using the singleton from [lib/supabase.js](lib/supabase.js).

**Pages** (Next.js App Router under [app/](app/)):
- `/` — Login via Google OAuth; first-time users choose a `nombre_jugador` (≥3 chars), saved to `usuarios` table
- `/dashboard` — Tab-based hub; entry point after login
- `/simulador` — Multi-step wizard for entering predictions across all phases
- `/prode` — Displays the current user's saved predictions
- `/fixture` — Browse all official matches, group standings, knockout bracket
- `/ranking` — Leaderboard with scoring: exact result = 3pts, correct trend = 1pt
- `/grupos` — Create or join groups via access codes
- `/admin` — Enter official match results (restricted)

**Database tables** (Supabase/PostgreSQL):
- `usuarios` — user profiles (`id`, `nombre_jugador`)
- `equipos` — teams (`nombre`, `bandera_url`, `grupo`)
- `partidos` — matches (`fase`, `fecha_hora`, `goles_local`, `goles_visitante`, `estado`)
- `pronosticos` — predictions (`usuario_id`, `partido_id`, predicted goals) — upserted on save
- `grupos` — group rooms (`nombre`, `codigo_acceso`)
- `miembros_grupo` — group membership junction

**Scoring logic** (in [app/ranking/page.tsx](app/ranking/page.tsx)):  
Fetches all `estado='Finalizado'` matches, joins with all predictions and users, calculates pts per user, sorts by pts → exact hits → trend hits. Filterable by phase (Fecha 1/2/3 of groups, then each knockout round).

**Phase grouping** for group-stage matches: Fecha 1 = day ≤ 15, Fecha 2 = day ≤ 21, Fecha 3 = day > 21 (June).

## Key Conventions

- All pages use React hooks only (`useState`, `useEffect`, `useMemo`, `useCallback`) — no global state library.
- Tailwind CSS v4 via `@tailwindcss/postcss`; styles in [app/globals.css](app/globals.css).
- Path alias `@/*` resolves to the project root.
- Icons from `lucide-react`.
- Before editing any Next.js-specific code (routing, layouts, data fetching, image optimization, middleware), read the relevant guide in `node_modules/next/dist/docs/` — this is Next.js 16 and has breaking changes from prior versions.
