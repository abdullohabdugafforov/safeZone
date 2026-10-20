# 0003 — UI design language

- Status: accepted
- Date: 2026-10-20

## Context

The user asked to base the app's look on an existing design system
(the "junior" brand of design.pdp.uz), without using its logos or brand names.

## Decision

Adopt the system's tokens in `apps/mobile/src/ui/theme.ts`:

- **Colors**: white / `#F8F8F8` background, ink `#002227` text and hero panels,
  cyan `#00E0EF` accents, cyan-deep `#00CDDA` primary buttons with deep
  `#004450` text, deep buttons with white text, teal `#0A8992` icons in
  `#D5F2F4` circles, pastel cards (`#A8F0FF`, `#FFDB9D`, `#EBFFB2`).
  Only the contrast pairs allowed by the system are used. Rough ratio:
  60 % light, 25 % ink, 10 % cyan, 5 % accent.
- **Type**: Onest (400/500/600/700); IBM Plex Mono for codes.
- **Icons**: Phosphor — Regular by default, Fill for active/selected.
- **Shape**: radii 8/12/16/24, spacing scale 4–48.
- **Pattern**: orange→cyan wave in hero panels.
- Dark mode derives from the ink palette.

No logos, logotype lockups or brand names are used anywhere in the app.

## Consequences

UI primitives live in `src/ui/components.tsx`; screens compose them instead of
styling ad hoc. Fonts load at startup via `expo-font` (falls back to system
fonts on failure).
