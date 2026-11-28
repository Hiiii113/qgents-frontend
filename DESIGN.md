---
name: Qgents
description: Quiet Neutral Desktop AI Workspace for human teams and project-scoped AI Agents (Proma / Linear / Claude Desktop craft bar).
colors:
  canvas-white: "#FFFFFF"
  rail-neutral: "#F7F7F8"
  soft-neutral: "#FAFAFA"
  sunken-neutral: "#F2F2F4"
  border-hairline: "rgba(24, 24, 27, 0.075)"
  border-strong: "rgba(24, 24, 27, 0.13)"
  ink-primary: "#18181B"
  ink-hover: "#27272A"
  ink-body: "#3F3F46"
  ink-secondary: "#52525B"
  ink-muted: "#71717A"
  ink-disabled: "#A1A1AA"
  accent-link: "#27272A"
  accent-strong: "#18181B"
  accent-tint: "rgba(24, 24, 27, 0.055)"
  accent-line: "rgba(24, 24, 27, 0.14)"
  status-ok: "#16794B"
  status-ok-soft: "rgba(22, 121, 75, 0.08)"
  status-wait: "#A16207"
  status-wait-soft: "rgba(161, 98, 7, 0.08)"
  status-danger: "#C83737"
  status-danger-strong: "#A82A2A"
  status-danger-soft: "rgba(200, 55, 55, 0.08)"
typography:
  headline:
    fontFamily: "'Geist Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "'Geist Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  body:
    fontFamily: "'Geist Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "0em"
  ui:
    fontFamily: "'Geist Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.55
    letterSpacing: "0em"
  label:
    fontFamily: "'Geist Mono', ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  pill: "999px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "20px"
  s6: "24px"
  s8: "32px"
  s10: "40px"
components:
  button-primary:
    backgroundColor: "{colors.ink-primary}"
    textColor: "{colors.canvas-white}"
    rounded: "{rounded.sm}"
    height: "34px"
    padding: "0 13px"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
    textColor: "{colors.canvas-white}"
  button-quiet:
    backgroundColor: "{colors.canvas-white}"
    textColor: "{colors.ink-body}"
    rounded: "{rounded.sm}"
    height: "34px"
    padding: "0 13px"
  tag-status:
    backgroundColor: "{colors.sunken-slate}"
    textColor: "{colors.ink-body}"
    rounded: "{rounded.xs}"
    height: "22px"
    padding: "0 8px"
  input-field:
    backgroundColor: "{colors.canvas-white}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "7px 10px"
  composer-box:
    backgroundColor: "{colors.canvas-white}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.lg}"
    padding: "8px 12px 6px"
---

# Design System: Qgents

## Overview

**Creative North Star: "Calm Neutral Precision"**

Qgents is an everyday collaborative workspace where product, design, and engineering teammates work alongside project-scoped AI Agents. Its visual system follows the Clean Neutral SaaS canon executed at the craft bar of **Linear** and **Notion**: pure white working canvases, cool slate-tinted navigation rails and sidebars, razor-sharp 1px hairlines, deep slate-ink primary actions, and a single calm precision-cobalt accent (`#2563EB`) reserved for active navigation, links, focus rings, and live Agent selection.

**Key Characteristics:**
- Single token source of truth in `src/theme/tokens.ts`, injected as CSS custom properties onto `:root` and mirrored into Ant Design 6's `antdTheme.ts`.
- Calm cool-slate tonal separation (`#FFFFFF` canvas, `#F8FAFC` rail/sidebar, `#F1F5F9` sunken hover/code fills) with zero decorative gradients or warm vermilion accents.
- Comfortable Chinese/Latin typography pairing `Geist` + `PingFang SC` / `Microsoft YaHei` with `Geist Mono` tabular numerals for timestamps, IDs, counts, and Agent tool steps.

## Colors

**The Single-Accent Rule.** Precision cobalt (`#2563EB` / `#1D4ED8`) owns focus, active navigation indicators, hyperlinks, text selection, and active Agent run highlights. Primary buttons stay high-contrast slate ink (`#0F172A`) so action weight never competes with state or navigation cues.

- **Surfaces**: `#FFFFFF` (working canvas, active cards, modals), `#F8FAFC` (64px rail, 288px conversation sidebar, RunCard header strip), `#F1F5F9` (hover rows, inline code, disabled pills).
- **Text Ink**: `#0F172A` (headings/primary), `#334155` (body copy), `#475569` (secondary labels), `#64748B` (muted metadata & placeholders, ≥ 4.5:1 on white), `#94A3B8` (disabled hints).
- **Borders**: `#E2E8F0` (default 1px structural divider), `#CBD5E1` (stronger control & active card borders).
- **Semantic Status**: Emerald `#15803D` / `#F0FDF4` (completed/active), Amber `#B45309` / `#FFFBEB` (waiting/pending), Crimson `#DC2626` / `#FEF2F2` (stop/rejected/destructive).

## Typography

- **Sans Stack**: `'Geist Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', system-ui, sans-serif`.
- **Mono Stack**: `'Geist Mono', ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, monospace` with `font-variant-numeric: tabular-nums`.
- **Scale**: `28px` (`--t-h1`), `24px` (`--t-h2`, chat headers), `20px` (`--t-h3`), `15px` (`--t-body`, `1.65` line-height, `68ch` measure), `14px` (`--t-ui`), `13px` (`--t-sm`), `12px` (`--t-xs`).

## Layout

- **AppShell**: Fixed `64px` left navigation rail (`--surface-rail`) + `56px` top appbar (`--surface`) + optional `288px` conversation sidebar (`--surface-soft`) + flexible working canvas (`--surface`, max-width `1160px` on non-chat views).
- **Spacing Scale**: 4px base grid (`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40px`).
- **Responsive Breakpoints**:
  - `<= 1280px`: right member sidepanel narrows to `310px`.
  - `<= 1100px`: conversation sidebar and member sidepanel collapse into slide-over drawers with scrim.
  - `<= 900px`: left rail converts to a single-line horizontal top bar (`white-space: nowrap`, hidden scrollbar).

## Elevation & Depth

**The Hairline-First Rule.** Structural hierarchy is declared once via 1px borders (`--line` / `--line-strong`) and surface contrast (`#FFFFFF` vs `#F8FAFC`). Subtle tactile depth (`--shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.05)`) is applied sparingly to active rail buttons, active conversation rows, buttons, and Agent RunCards; layered elevation (`--shadow`) is reserved strictly for modals, popovers, and floating jump controls.

## Shapes

- Geometric radii: `4px` (`--r-xs` tags/code), `6px` (`--r-sm` buttons/inputs), `8px` (`--r-md` cards/rows/RunCards), `10px` (`--r-lg` composer dock & studio preview), `999px` (`--r-pill` unread badges & send button).
- Full borders everywhere on rounded containers; no one-sided accent bars on rounded boxes.

## Components

- **Navigation Rail (`.rail__btn`)**: Active page renders as an elevated `#FFFFFF` tile with `1px solid var(--line)`, `--shadow-sm`, and a `2.5px` precision-cobalt left indicator bar.
- **Conversation Rows (`.grouprow`, `.dmrow`)**: Unified `8px` radius, `1px` border, `#F1F5F9` hover, `#FFFFFF` active card with `--shadow-sm`, solid `#0F172A` unread pill badges, and cobalt fresh timestamps.
- **Agent RunCard (`.run`)**: White card with `#F8FAFC` header strip, `#BFDBFE` border while running, live status beacon, expandable monospace tool-call timeline, and inline stop button.
- **Chat Composer (`.composer__box`)**: `10px` radius white dock with `3px` `#EFF6FF` cobalt focus ring on `:focus-within`, `#0F172A` pill send button, and high-legibility `#F1F5F9` disabled send state.
- **Status Tags (`.tag`)**: Strictly `22px` height, `fit-content`, never stretched; semantic tones (`ok`, `wait`, `stop`, `agent`, `readonly`).

## Do's and Don'ts

### Do:
- **Do** source every color, radius, spacing, and typography value from `src/theme/tokens.ts` CSS variables.
- **Do** keep tabular numerals (`font-variant-numeric: tabular-nums`) on all timestamps, unread counts, and Agent step indices.
- **Do** reserve `#DC2626` / `#FEF2F2` strictly for stop, error, rejection, and destructive states.

### Don't:
- **Don't** reintroduce vermilion/red (`#B03A2B` / `#F9EAE7`) brand accents, decorative gradients, or glowing neon shadows.
- **Don't** place one-sided accent borders on rounded boxes or add top borders to stacked centered empty states.
- **Don't** introduce Tailwind or a second UI component library alongside Ant Design 6 and `src/components/ui`.
