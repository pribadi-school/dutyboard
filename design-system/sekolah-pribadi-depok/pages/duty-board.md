# Page override: Teachers on Duty board

> Extends/overrides `../MASTER.md` for the duty board only. Everything not
> listed here follows MASTER.md unchanged (palette, Inter, 8px rhythm, flat
> elevation, radius, motion timings, reduced-motion rule, no emojis as icons,
> focus states). Tokens live in `src/index.css` (`@theme`).

## 1. Action blue (same as the appointment app)

White on `#18a8fa` is 2.62:1 and fails AA. Interactive fills and blue text use
`--color-action` = gradient-start `#0172bb` (5.09:1 on white). `#18a8fa` stays
for non-text decoration (tints, rings).

## 2. Duty status

Colour is never the only cue: every status has an icon and a text label.

| Status (EN / ID) | Background | Text | Extra cue |
|---|---|---|---|
| Now / Sekarang | `gradient-end 14% → surface` | `foreground` | teal ring + pulsing teal dot; the list row is tinted the same |
| Next / Berikutnya | `action-tint` | `action` | → arrow |
| Done / Selesai | `surface-page` | `muted-foreground` | ✓ icon; the list row text is muted |
| Substitute for … / Menggantikan … | `accent 10% → surface` | `foreground` | ⇄ icon in accent orange (orange = a human change, per MASTER) |
| My duty (week view) | `action-tint` | `action`, bold | ★ icon with label |
| Approximate time | — | — | “±” before the time, tooltip “Approximate time” |

## 3. TV layout (1920×1080, read from across the lobby)

- Full screen, no app header; logo, greeting, big WIB clock.
- Text sized in `vh`; card text in container units (`cqh`/`cqw`) so it fits
  any TV or player app. Cards: one row of up to 6, then 6 × 2, then paging.
- Today's list in three balanced columns, two lines per row (who; where).
- Offline: an accent “Offline · last updated 07.12” chip; the data stays.

## 4. Live indicator

Same as the appointment app: teal dot with a ping ring and “Live”; when the
5-second poll fails, a grey dot and “Offline”.
