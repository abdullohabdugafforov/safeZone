# SafeKid

Parental-control mobile app for parents and children. One app, two roles:
parents control child devices remotely; children link their device to a parent
(parent approval required).

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Decisions: [docs/decisions/](docs/decisions/)

## Repository layout

| Path              | What                                                                         |
| ----------------- | ---------------------------------------------------------------------------- |
| `apps/backend`    | NestJS API (PostgreSQL via Prisma, Redis, WebSocket, FCM)                    |
| `apps/mobile`     | React Native + Expo app (dev builds) with the `device-control` native module |
| `packages/shared` | Shared TypeScript types and zod schemas                                      |
| `docs/`           | Architecture and ADRs                                                        |

## Prerequisites

- Node.js 22 (`.nvmrc`), pnpm 11 (`corepack enable`)
- Docker Desktop
- Android: Android Studio + SDK, JDK 17+, a physical device or emulator

## Setup

```bash
pnpm install
cp .env.example .env               # dev service ports/credentials
docker compose up -d               # Postgres on :5433, Redis on :6380
```

Backend and mobile setup steps are added as those apps land (see below).

## Common commands

```bash
pnpm typecheck      # all workspaces
pnpm lint
pnpm test
pnpm format
docker compose down # stop services (add -v to wipe data)
```
