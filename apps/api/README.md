# Meal Tracker API

NestJS backend for Meal Tracker. See the repo root's `CLAUDE.md` and `docs/` for product context, schema, and API design — this README only covers running the app.

## Commands

```bash
pnpm dev          # swc watch build + node --watch dist/main.js
pnpm build        # swc build to dist/
pnpm start        # run the built dist/main.js
pnpm test         # unit tests (vitest)
pnpm test:e2e     # e2e tests (vitest)
pnpm lint         # eslint
pnpm check-types  # tsc --noEmit
```

By default, the server runs at [localhost:3000](http://localhost:3000).

**Building or testing this app requires `packages/*` to be built first** (e.g. `@repo/api`) — `pnpm build`/`pnpm test` from the repo root handle this automatically via Turborepo's task graph.
