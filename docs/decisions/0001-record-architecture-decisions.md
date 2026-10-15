# 0001 — Record architecture decisions

- Status: accepted
- Date: 2026-10-15

## Context

The project spans a backend, a mobile app and native modules on two platforms.
Decisions need to stay discoverable for future contributors (and for Claude).

## Decision

Record significant decisions as short ADRs in `docs/decisions/NNNN-title.md`
(Context, Decision, Consequences). Initial decisions captured in
`docs/ARCHITECTURE.md`:

- Child is a profile inside a family; child devices authenticate with device
  credentials issued only after explicit parent approval (no child phone/OTP).
- Policies are per child, stored as append-only versions; devices sync by version.
- Lock/unlock is part of the policy (durable, enforced offline), not a one-off command.
- Push (FCM/WebSocket) is only a "sync" hint; state is always pulled over REST.
- Multiple parents per family are supported by the schema; invite UI is out of Phase 1.
- UI languages: Uzbek (default), Russian, English.
- Tooling: TypeScript 5.9 (TS 7 native compiler is not yet supported by ts-jest /
  Nest tooling), Prisma 7 stable, NestJS 12, Expo SDK 57.

## Consequences

Each new significant decision gets its own ADR.
