# ChillBuilder

A medieval city builder / god game / tower defense hybrid. Build an economy, defend it from raiders, and grow your own divine power from the population's worship.

Targets: browser, Android, iOS, and Steam from one codebase.

See `docs/` (once added) or the project plan for the full architecture and milestone breakdown.

## Structure

- `packages/game` — the actual game (Phaser 4 + TypeScript + Vite). Everything gameplay-related lives here.
- `packages/mobile` — Capacitor wrapper for Android/iOS (added in a later milestone).
- `packages/desktop` — Electron wrapper for Steam (added in a later milestone).

## Getting started

```
npm install
npm run dev        # starts the game's Vite dev server
npm run build:web  # production browser build
npm run typecheck
npm run test
```

Requires Node.js 24 (see `.nvmrc`).
