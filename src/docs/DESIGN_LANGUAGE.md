# PAWN — Design Language

One organism. Every screen a projection of the same DNA.

## Tokens (locked)

| Token | Value | Rule |
| --- | --- | --- |
| `--ivory` | commerce body | default public surface |
| `--paper` | editorial silence | narrative/hero surface |
| `--bone` | secondary panel | alternating rhythm |
| `--ink` | authority | admin / decision context |
| `--oxblood` | decision | **single decision per view** |
| `--gold` | accolade | verified / awarded — rare |
| `--radius` | `0` | no rounded corners, anywhere |
| `--ease-pawn` | `cubic-bezier(.2,.7,.2,1)` | the only easing |
| `--dur-micro` `--dur-reveal` | 180ms / 520ms | the only two durations |

## Type scale (locked)

Use these utilities. Never inline `text-[..]` sizes in pages.

| Utility | Purpose |
| --- | --- |
| `.t-display-xl` | hero titles (Home, DNA opener) |
| `.t-display-lg` | page title (PageHeader h1) |
| `.t-display-md` | section title (SectionHeader h2) |
| `.t-display-sm` | panel title, KPI value |
| `.t-body-lg` | lede |
| `.t-body-md` | default body |
| `.t-body-sm` | captions, list rows |
| `.t-eyebrow` | UPPERCASE 0.65rem 0.32em tracking |
| `.t-num` | Playfair italic numerals |

## Spacing rhythm

`4 · 8 · 16 · 24 · 40 · 64 · 96`. Sections use `.section-y` (16/24) or `.section-y-lg` (24/32).

## Surface hierarchy

`paper → ivory → bone → ink`. Never stack same surface. Ink surfaces cannot host ink panels.

## Border language

Only hairlines. `border`, `hairline`, `hairline-strong`. No shadows on public surfaces.

## Primitives

Import from `@/components/pawn/primitives`.

| Primitive | Replaces |
| --- | --- |
| `Panel` | ad-hoc `border border-border bg-card` boxes; portal/admin local `Card` |
| `PageHeader` | inline page title blocks |
| `SectionHeader` | legacy `SectionHeading` (still exported as alias) |
| `Metric` | `StatCard`, inline KPI divs |
| `Timeline` | account order steps, dossier progression |
| `ActivityList` | cockpit feed, portal activity |
| `Insight` | ad-hoc rationale/observation cards |
| `Recommendation` | AI suggestion rows |
| `Command` | ad-hoc `<button>`/`<Button>` in editorial contexts |
| `Status` | live/watch/risk dot pills |
| `IdentityChip` | avatar+name inline label |
| `Hairline` | `<div className="h-px …" />` |
| `ChessSeam` | `ChessDivider` (still exported) |

## How to add a new screen

1. `PublicLayout` / `AdminShell` / `PortalShell` — never build your own.
2. Start with a `PageHeader`.
3. Compose sections with `SectionHeader` + one or more `Panel`s.
4. Any KPI = `Metric`. Any reasoning = `Insight`. Any suggestion = `Recommendation`.
5. One `Command variant="decision"` per view. All other actions `variant="ink"` / `paper` / `ghost`.
6. Never introduce a new border/radius/shadow/font size. Extend the language here first.

## Removed inconsistencies

- Local `Card` in portal → `Panel`.
- Local `Kpi` in portal, `KPI` in account, `StatCard`, `Kpi` cell in admin — all `Metric`.
- Ad-hoc `border border-border bg-card` wrappers in account/checkout/cart → `Panel`.
- Inline `text-[3rem]` / `text-[6rem]` on titles → `.t-display-*`.
- Multiple button treatments (`bg-foreground`, `bg-accent`, `decision-pill`, `rounded-none Button`) → `Command`.
