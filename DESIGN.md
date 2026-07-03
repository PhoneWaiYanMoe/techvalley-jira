# Design System — TechValley Jira Lite

Single source of truth for UI patterns, tokens, and component conventions.
All new components **must** follow these guidelines to maintain visual consistency.

---

## Typography

Fonts are loaded via `next/font/google` in `src/app/layout.tsx` as CSS variables.

| Token | Value | Usage |
|---|---|---|
| Sans | `Geist` (via `--font-geist-sans`) | Body text, UI labels, headings |
| Mono | `Geist Mono` (via `--font-geist-mono`) | Counts, timestamps, code, status badges |

> **Note**: The design prototype uses `Plus Jakarta Sans` and `Space Grotesk`.
> The production implementation uses `Geist` / `Geist Mono` (the Next.js default).
> Both are clean geometric sans-serifs — the visual feel is equivalent.

### Font sizes

| Tailwind | px | Usage |
|---|---|---|
| `text-[10px]` | 10 | Section labels (uppercase), mono timestamps |
| `text-[10.5px]` | 10.5 | Sidebar badge counts, meta labels |
| `text-[11px]` | 11 | Small labels, helper text, status pills |
| `text-[11.5px]` | 11.5 | Hint text, slot indicators |
| `text-xs` | 12 | Secondary text, card meta |
| `text-[12.5px]` | 12.5 | Nav items, filter buttons |
| `text-[12.8px]` | 12.8 | Card descriptions, list items |
| `text-[13px]` | 13 | Body text, form inputs, modal text |
| `text-[13.5px]` | 13.5 | Section headings, card titles |
| `text-sm` | 14 | Form labels, button text |
| `text-[15px]` | 15 | Sidebar brand name, empty-state headings |
| `text-base` | 16 | — |
| `text-lg` | 18 | Modal headings |
| `text-xl` | 20 | Page headings |
| `text-3xl` | 30 | KPI values, donut center |

### Font weights

| Weight | Tailwind | Usage |
|---|---|---|
| 400 | `font-normal` | Body text |
| 500 | `font-medium` | — |
| 600 | `font-semibold` | Nav items, labels, card text |
| 700 | `font-bold` | Headings, buttons, active nav |
| 800 | `font-extrabold` | KPI values, logo letter, card initial |

---

## Color Palette

### Neutral (backgrounds, borders, text)

| Token | Light | Dark | Usage |
|---|---|---|---|
| `neutral-50` | `#fafafa` | `#0a0a0a` | Page background, sidebar bg |
| `neutral-100` | `#f5f5f5` | `#171717` | Card hover bg, tab track, select bg |
| `neutral-200` | `#e5e5e5` | `#262626` | Borders, dividers |
| `neutral-300` | `#d4d4d4` | `#404040` | Input borders |
| `neutral-400` | `#a3a3a3` | `#525252` | Placeholder text, faint labels |
| `neutral-500` | `#737373` | `#a3a3a3` | Secondary text, muted |
| `neutral-600` | `#525252` | `#d4d4d4` | — |
| `neutral-800` | `#262626` | `#e5e5e5` | Dark mode card bg |
| `neutral-900` | `#171717` | `#f5f5f5` | Dark mode surface |
| `neutral-950` | `#0a0a0a` | `#fafafa` | Dark mode page bg |

### Accent (primary brand color)

| Token | Hex | Usage |
|---|---|---|
| `indigo-50` | `#eef2ff` | Active nav bg, AI card bg, badge bg |
| `indigo-100` | `#e0e7ff` | AI badge bg |
| `indigo-200` | `#c7d2fe` | AI card border |
| `indigo-400` | `#818cf8` | — |
| `indigo-600` | `#4f46e5` | Primary buttons, active nav text, avatar bg, KPI dot, donut center bg |
| `indigo-900` | `#312e81` | Dark mode AI badge bg |
| `indigo-950` | `#1e1b4b` | Dark mode active nav bg, AI card bg |

### Semantic Colors

| Color | Hex | Usage |
|---|---|---|
| **Emerald** | `#10b981` | Done status, success, completion KPI |
| **Amber** | `#e0982e` | In Review status, medium priority, due-soon |
| **Rose** | `#f43f5e` | High priority, overdue, error |
| **Sky** | `#0ea5e9` | — |
| **Violet** | `#8b5cf6` | — |
| **Slate** | `#94a3b8` | Backlog status, low priority |

### Status Colors (fixed mapping)

```typescript
const STATUS_COLORS = {
  "Backlog":      "#94a3b8",  // slate
  "In Progress":  "#6366f1",  // indigo
  "In Review":    "#e0982e",  // amber
  "Done":         "#10b981",  // emerald
};
```

### Priority Colors (fixed mapping)

```typescript
const PRIORITY_COLORS = {
  "HIGH":   "#f43f5e",  // rose
  "MEDIUM": "#e0982e",  // amber
  "LOW":    "#94a3b8",  // slate
};
```

---

## Spacing & Layout

### Page layout

```
┌─────────────────────────────────────────────┐
│ Sidebar (w-250px, fixed) │ Main (flex-1)    │
│                          │                  │
│  Logo                    │  Top bar         │
│  Nav items               │  Content (p-6)   │
│  User section            │                  │
└─────────────────────────────────────────────┘
```

- **Sidebar**: `w-[250px]`, `shrink-0`, `border-r`, `p-4`
- **Main**: `flex-1`, `overflow-y-auto`
- **Content padding**: `p-6 pb-10`
- **Page max-width**: none (sidebar handles the constraint)

### Card grid

```css
grid-cols-[repeat(auto-fill,minmax(310px,1fr))]
gap-4
```

### KPI grid

```css
grid-cols-[repeat(auto-fit,minmax(180px,1fr))]
gap-3.5
```

### Dashboard two-column

```css
grid-cols-[1.15fr_1fr]
gap-4
/* Collapses to single column on < lg */
max-lg:grid-cols-1
```

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `rounded-md` | 6px | Buttons, inputs, mini bars |
| `rounded-lg` | 8px | Cards (inner elements), badges, nav items, avatar circles |
| `rounded-xl` | 12px | Cards (outer container), modals, KPI cards |
| `rounded-2xl` | 16px | Empty-state icon containers |
| `rounded-full` | 9999px | Avatars, donut chart, status dots |

---

## Shadows

| Token | Value | Usage |
|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,.05)` | Cards, inputs, buttons |
| `shadow-md` | `0 4px 6px rgba(0,0,0,.1)` | Card hover state |
| `shadow-2xl` | `0 25px 50px rgba(0,0,0,.25)` | Modal backdrop |

---

## Component Patterns

### Buttons

**Primary** (action buttons):
```
bg-indigo-600 text-white font-bold text-[13px]
rounded-lg px-4 py-2.5
shadow-sm hover:shadow-md
disabled:opacity-60 disabled:cursor-not-allowed
```

**Secondary** (cancel, back):
```
border border-neutral-200 bg-white text-neutral-500
dark:border-neutral-700 dark:bg-neutral-900
rounded-lg px-4 py-2.5 text-[13px] font-semibold
```

**Ghost** (icon-only, sidebar nav):
```
bg-transparent text-neutral-500
hover:bg-neutral-100 dark:hover:bg-neutral-800
rounded-lg
```

### Inputs

```
border border-neutral-200 bg-white
dark:border-neutral-700 dark:bg-neutral-900
rounded-lg px-3 py-2.5 text-[13px]
outline-none focus:ring-2 focus:ring-neutral-300
dark:focus:ring-neutral-600
```

### Cards

```
border border-neutral-200 bg-white
dark:border-neutral-800 dark:bg-neutral-900
rounded-xl p-4.5 shadow-sm
transition-all hover:-translate-y-0.5 hover:shadow-md
```

### Status Pills

```
rounded-full px-2.5 py-0.5 text-[10.5px] font-bold
{statusBg} {statusText}
```

Where:
- Backlog: `bg-neutral-100 text-neutral-500`
- In Progress: `bg-indigo-50 text-indigo-600`
- In Review: `bg-amber-50 text-amber-600`
- Done: `bg-emerald-50 text-emerald-600`

### Avatars

```
rounded-full flex items-center justify-center
text-[10px] font-bold text-white
h-[size] w-[size]
```

Sizes: `h-5 w-5` (tiny), `h-6 w-6` (small), `h-[22px] w-[22px]` (medium), `h-[26px] w-[26px]` (large), `h-[30px] w-[30px]` (sidebar)

### Modals

```
fixed inset-0 z-50
bg-[rgba(15,20,35,.45)] backdrop-blur-sm
flex items-center justify-center
animate-[fadeIn_.18s_ease]

Inner:
w-[460px] max-w-[calc(100vw-40px)]
rounded-xl border border-neutral-200 bg-white p-6
shadow-2xl animate-[popIn_.24s_cubic-bezier(.2,.7,.2,1)]
dark:border-neutral-800 dark:bg-neutral-900
```

### Loading Spinner

```
h-6 w-6 animate-spin rounded-full
border-2 border-neutral-300 border-t-indigo-600
```

---

## Dark Mode

All components use Tailwind's `dark:` prefix. The strategy:

- **Backgrounds**: `bg-white dark:bg-neutral-900` (cards), `bg-neutral-50 dark:bg-neutral-950` (pages)
- **Borders**: `border-neutral-200 dark:border-neutral-800`
- **Text**: `text-neutral-900 dark:text-neutral-100` (primary), `text-neutral-500 dark:text-neutral-400` (secondary)
- **Accents**: same hex values in both modes (indigo-600, emerald-600, etc.)

---

## Animations & Transitions

| Name | Definition | Usage |
|---|---|---|
| `fadeIn` | `from { opacity: 0 } to { opacity: 1 }` | Modal backdrop, AI text |
| `popIn` | `from { opacity: 0; transform: translateY(8px) scale(.98) } to { opacity: 1; transform: none }` | Modal content |
| `transition-all` | `transition-property: all; duration: 150ms` | Card hover (translate + shadow) |
| `transition-colors` | `transition-property: colors` | Buttons, nav links, sidebar links, tab buttons, favorite toggle |
| `transition-opacity` | `transition-property: opacity` | Modal CTA button (disabled state) |
| `transition-[width]` | `duration: 500ms; ease-out` | Bar chart fill animation |
| `animate-spin` | Tailwind built-in | Loading spinner |
| `hover:-translate-y-0.5` | Card lift on hover | Project cards only |

---

## Component File Organization

```
src/components/
  ui/              — Shared primitives (Button, Input)
  layout/          — Shell components (Sidebar, Navbar)
  auth/            — Auth-related (LoginForm, SignupForm, LogoutButton)
  profile/         — Profile-related (ProfileForm, PasswordChangeForm)
  projects/        — Project workspace (ProjectCard, CreateProjectModal,
                     StatusDonut, BarChart, ProjectDashboard)
```

### Naming conventions

- **Files**: PascalCase, one component per file
- **Exports**: named exports (`export function X()`), no default exports
- **Client components**: `"use client"` directive at top
- **Server components**: no directive (default)
- **Types**: co-located in `src/types/api.ts` (response DTOs) and `src/validation/*.schema.ts` (request bodies via `z.infer`)

---

## Responsive Breakpoints

The current implementation is desktop-first (min-width 1024px). The sidebar is fixed at 250px; the main area scrolls. The dashboard two-column layout collapses at `lg` breakpoint.

Future work: add mobile sidebar toggle, responsive card grid adjustments.

---

## Tailwind v4 Notes

- **No `tailwind.config.js`** — Tailwind v4 uses `@import "tailwindcss"` and `@theme inline` in `globals.css`.
- **Half-step spacing** — the project uses `.5` increments freely: `p-4.5`, `px-4.5`, `mb-4.5`, `gap-3.5`, `gap-2.5`, `gap-1.5`, `gap-0.5`.
- **Arbitrary values** — used for non-standard sizes: `text-[10.5px]`, `text-[12.8px]`, `text-[13.5px]`, `w-[250px]`, `h-[38px]`, `rounded-[10px]`, `minmax(310px,1fr)`, etc.
- **CSS custom properties** — `--background` and `--foreground` are defined in `globals.css` with `prefers-color-scheme: dark` media query (OS-level). Component-level dark mode uses Tailwind's `dark:` class prefix instead.

## Design Prototype Reference

The visual design originates from `Project Workspace.dc.html` in the Claude Design project
(`0bca8977-545f-4704-810f-bea2acb63781`). The prototype uses three themes (studio, soft, mono)
— the production implementation uses the **studio** theme as the base, adapted to Tailwind's
neutral/indigo/emerald palette.
