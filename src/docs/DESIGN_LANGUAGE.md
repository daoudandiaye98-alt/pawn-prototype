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
| Kurven | `--kurve-standard`, `--kurve-fein`, `--kurve-dramatisch` | die einzigen drei (Teil B0, `src/styles/bewegung.css`). `--ease-pawn` ist nur noch ein Deckname für `--kurve-dramatisch`. |
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

## Component library (Teil 26b)

PAWN had three parallel component systems (shadcn/ui, `.palace-btn` editorial CSS,
`@/components/pawn/primitives`). Only one survives: **shadcn/ui** (`@/components/ui/*`).
It was the only one of the three that already covered all seven baseline shapes
(button, field, card, table, dialog, message, empty-state) — the other two only ever
covered a slice (buttons, mostly) and would have needed the missing pieces built from
scratch. `@/components/pawn/primitives` is deleted; `.palace-btn` is deleted, replaced
by `<Button variant="editorial" size="chip">` (same visual: 1.5px border, uppercase
tracked label, hover-invert — just no longer a hand-written CSS class floating outside
the component tree).

Import from `@/components/ui/*`. Notable additions made when it was chosen:

| Piece | What it covers |
| --- | --- |
| `Button` | states: default, disabled, `loading` (spinner), focus-visible ring. Variants include `editorial` (ex-`.palace-btn`) and `size="chip"` for its padding-driven height. Hover is always inversion, never opacity. |
| `Input` / `Textarea` | error state via `aria-invalid` (already wired by `Form`/react-hook-form) — a heavier border, no color, since only #000/#FFF exist. |
| `Card` | hairline border only, no soft shadow. |
| `Table` | unchanged Radix-free primitive; pair with `EmptyState` for the no-rows case. |
| `Dialog` / `AlertDialog` / `Sheet` / `Drawer` | z-index and border/shadow now come from the shared scale below instead of ad-hoc values. |
| `EmptyState` (new) | the previously-missing seventh shape — icon/title/description/action, no ornament. |
| Toast | `sonner` only. The old parallel `@/components/ui/toast` + `use-toast` hook (two more competing message systems) is deleted. |

## Overlay z-index scale (Teil 26b)

Defined in `tailwind.config.ts` as named `zIndex` tokens — never invent a new bracket
value (`z-[73]` etc.) for an overlay again:

| Token | Value | Use |
| --- | --- | --- |
| `z-overlay` | 50 | Dialog/Sheet/Drawer backdrop scrim |
| `z-modal` | 60 | Dialog/Sheet/Drawer content, ad-hoc modals |
| `z-flyout` | 70 | Chat drawer, consent banner |
| `z-modal-top` | 80 | A second overlay stacked above a modal |
| `z-nav-overlay` | 90 | Mobile nav menu |
| `z-toast` | 100 | Toasts, Cover Moment, Level Up — always on top |
| `z-transition` | 200 | Full-app transition (Schwelle) — the one thing allowed above toasts |

## How to add a new screen

1. `PublicLayout` / `AdminShell` / `PortalShell` — never build your own.
2. Compose from `@/components/ui/*`. Reach for `Card` for any boxed content, `Table`
   for tabular data, `EmptyState` for the no-data case.
3. Never introduce a new border/radius/shadow/font size. Extend the language here first.
4. New hand-rolled `<button>`/`<input>` markup is flagged by an ESLint rule — use
   `Button`/`Input` instead.

## Removed inconsistencies

- Local `Card` in portal, `Panel` from the retired primitives library → `@/components/ui/card`.
- `.palace-btn` (14 files) → `Button variant="editorial"`.
- Three separate message systems (`sonner`, shadcn `toast`, shadcn `use-toast` hook) → `sonner` only.
- Seven ad-hoc overlay z-index values (50/60/70/80/90/100/200 as bare brackets) → the named scale above.
- Inline `text-[3rem]` / `text-[6rem]` on titles → `.t-display-*`.
