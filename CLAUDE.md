# SafeKid — project context for Claude

Parental-control mobile app (similar to Google Family Link / Kaspersky Safe Kids).
One app with two roles chosen at onboarding:

- **Parent**: signs in with phone + SMS OTP, links children, controls child devices remotely.
- **Child**: installs the same app, links to a parent (parent approval required), device gets enforced.

Distributed via Google Play and the App Store. Android first (Phase 1); iOS later.

Full architecture, data model, API and flows: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Decisions log: `docs/decisions/` (one ADR per significant decision).

## Language

- Talk to the user in **Uzbek**.
- Write all code, comments, commit messages, docs and UI string keys in **English**.

## Repository layout (pnpm workspaces)

```
apps/mobile        React Native + Expo (TypeScript, dev builds, Expo Router)
  modules/device-control   Local Expo module (Kotlin now, Swift later)
apps/backend       NestJS + Prisma (PostgreSQL) + Redis + WebSocket + FCM
packages/shared    Shared TS types + zod schemas (single source of API contracts)
docs/              Architecture + ADRs
docker-compose.yml Postgres + Redis for local dev
```

## Commands

```
pnpm install                     # install everything
docker compose up -d             # Postgres :5433 (+ safekid_test DB), Redis :6380
pnpm --filter backend prisma:migrate
pnpm --filter backend dev        # API on :3000
pnpm --filter backend test       # unit + e2e (needs docker compose up)
pnpm --filter mobile android     # build + run dev client on Android
pnpm -r typecheck && pnpm -r lint
```

Keep this section in sync when scripts change.

## Non-negotiable rules

1. **Security first**
   - No secrets in code or git. Config only via env vars, validated at startup with zod (`apps/backend/src/config`). Keep `.env.example` updated.
   - Validate **every** input with zod schemas from `packages/shared` — on the backend (pipe) and on mobile (forms + parsing API responses).
   - Authorization: a parent may only touch data of families they belong to. Every family/child/device/policy/command endpoint goes through a guard that resolves ownership from the DB — never trust IDs from the client alone.
   - Store only hashes of OTP codes, pairing codes and refresh tokens.
   - Log tamper and security events (`alerts` + `audit_logs`). Never log OTPs, tokens or full phone numbers (mask them).
2. **Never link a child device without explicit parent approval.**
3. **Offline enforcement**: the device stores the last applied policy locally and enforces it without network. The server is the source of truth; devices sync by `policyVersion`.
4. **Platform-agnostic native interface**: the TS API of `modules/device-control` must not leak Android concepts. Platform-specific details live behind capability flags.
5. **Google Play compliance**: show a prominent disclosure screen before requesting each sensitive permission (Accessibility, Usage Access, Device Admin, overlay, battery optimization, VPN). No hidden behavior.

## Conventions

- TypeScript `strict` everywhere. No `any` without a comment explaining why.
- Shared contracts: define the zod schema in `packages/shared`, infer the type with `z.infer`. Do not duplicate DTO types in apps.
- Backend: one NestJS module per domain (`auth`, `families`, `pairing`, `devices`, `policies`, `commands`, `alerts`, `notifications`). Controllers are thin; logic lives in services. External providers (SMS, push) are interfaces with dev + real implementations selected by env.
- DB: Prisma, snake_case table/column names via `@@map`/`@map`, camelCase in TS. UUID primary keys. Every schema change = a migration.
- API: REST under `/v1`, JSON, errors as `{ error: { code, message, details? } }`. Realtime via Socket.IO namespace `/realtime`.
- Mobile: Expo Router file-based routes split into `(parent)` and `(child)` groups. Server state via TanStack Query; small local state via Zustand. Tokens in `expo-secure-store`.
- Native (Kotlin): policy and device credentials persisted in encrypted storage; enforcement logic must not depend on the JS runtime being alive.
- Tests: Jest. Backend e2e tests run against a real Postgres (test database) — required for auth, pairing and policy access control.
- Formatting: Prettier + ESLint; run before committing.

## Workflow

- Small, focused commits per step, Conventional Commits style (`feat(backend): ...`, `chore: ...`).
- After each step: run typecheck, lint, tests/build, then report briefly (in Uzbek) what's done and what's next.
- Record notable decisions as ADRs in `docs/decisions/NNNN-title.md`.
