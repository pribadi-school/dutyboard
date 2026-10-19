# Teachers on Duty — project notes

Duty roster board for SD Pribadi Depok: lobby TV (`/`), week view for
teachers' phones (`/week`), print view (`/print`), admin editor (`/admin`).
README.md is the user-facing guide (data model, setup, deploy) — read it
first; this file is what's easy to get wrong while changing the code.

Stack: React 19 + Vite + TypeScript + Tailwind v4 (static build) and a PHP 8.1+
JSON API (`api/*.php`) on a cPanel MySQL/MariaDB database. **No Node on the
server, no Supabase or other third-party services.**

Sister project: the appointment app in `../appointment app` (same design
system, same deploy pattern). Read it, don't change it from here.

## Design system

`design-system/sekolah-pribadi-depok/MASTER.md` is a **copy** of the school's
design system (shared with the appointment app and website; update all if the
brand changes). `pages/duty-board.md` holds this app's additions and wins
where they differ.

- Every colour is a token in `src/index.css` `@theme`; Tailwind's palette is
  removed (`--color-*: initial`), so `bg-blue-500` doesn't exist.
- Interactive fills and blue text use `action` (#0172bb), never `primary`.
- Status is never colour alone: `DutyPill` = colour + icon + label
  (Now / Next / Done); a swap shows the orange “Substitute for …” badge.
- Respect `prefers-reduced-motion` (motion disabled, not shortened).
- TV text is sized in `vh` / container units (`cqh`/`cqw`) so it fits 1920×1080
  without scrolling; check `/` at 1920×1080 after layout changes, using `?now=`.

## Two backends, one contract

`src/lib/api/api.ts` is the contract. `phpApi.ts` talks to `api/*.php`;
`demoApi.ts` keeps everything in localStorage (admin password `demo`).
`npm run dev` = demo; production builds = PHP (`src/lib/api/index.ts`).

**Every admin action exists in three places**: the `AdminAction` union
(api.ts), `apply()` in demoApi.ts, and the `switch` in `api/admin.php`, with
the same validation and "in use" rules. Add/change all three together.

## PHP API rules — don't weaken these

- PDO prepared statements only (`q()` in `_lib.php`); never interpolate input
  into SQL. Table/column names in helpers are constants, never input.
- Validate every field server-side (`v_*` helpers) even though the UI does too.
- Every write: `require_admin()` (session + `X-CSRF-Token`), one transaction,
  `bump()` the version counter (the TVs poll it). A write that forgets `bump()`
  won't reach the TVs.
- Reads (`data.php`) return names and duties only. Nothing private, ever.
- Credentials: `duty-config.php` outside the web root (found by walking up
  from the site folder, or `DUTY_CONFIG`). Never commit it, never move it into
  `public_html`, never expose it to the front end.
- Long-running PHP (SSE, long polling) gets killed on shared hosting: keep the
  5-second `version.php` poll.
- PHP isn't installed on the dev machine by default; when you change PHP,
  say whether it was actually run.

## Roster logic

All "what's on when" logic lives in `src/lib/roster.ts` (tested in
`tests/roster.test.ts`): `rosterFor` (version by date), `windowsFor` (a
weekday's own time rows win over the every-day rows), `whoOn` (cell + one-day
swap), `includes` (my duties incl. group scope), `dayView`, `shownDay`.
Screens must not re-implement it. Run `npm test` after touching it.

Starting data: edit `src/data/seedRoster.ts`, then `npm run seed:generate` to
rebuild `sql/seed.sql`. Never hand-edit seed.sql. The seed is for empty
databases only (fixed ids).

## Hosting

cPanel (Niagahoster, user `pribadisch`), `duty.pribadidepok.sch.id` →
`public_html/duty`. GitHub Actions builds `main` onto the generated `deploy`
branch (`scripts/publish-deploy.ts`: dist + api + tools + sql + deploy.sh).
Server: `cd ~/repositories/duty-board && git pull && bash deploy.sh`.
The `deploy` branch keeps linear history on purpose (plain `git pull` on the
server fails on a force-push). `public/.htaccess` is the whitelist + SPA
fallback; keep `api/[a-z]+.php` naming (helpers start with `_` and are denied).

## Everyday commands

| Command | Use |
|---|---|
| `npm run dev` | demo mode, http://localhost:5173 |
| `npm run php` + `npm run dev:php` | real PHP API locally (needs PHP + MySQL, `duty-config.local.php`) |
| `npm test` | roster logic tests |
| `npm run build` | type-check + production build — run before pushing |
| `npm run seed:generate` | rebuild sql/seed.sql from src/data/seedRoster.ts |

## Other conventions

- All UI text lives in `src/lib/i18n.tsx`, in **both** English and Bahasa
  Indonesia (TypeScript enforces matching keys). Roster content is data.
- Times are WIB, shown `06.45`, whatever the device timezone: use
  `src/lib/time.ts`. `?now=07:20` simulates a time for checking screens.
- Teachers open `/week` on phones: check changes at 360 px wide.
