# Brief: Teachers on Duty board (new, separate app)

Paste everything below the line into a new Claude Code session opened in an
**empty new folder** (e.g. `F:\duty-board`), not inside `F:\appointment app`.

---

Build a new web app, **"Teachers on Duty"**, for SD Pribadi Depok. It shows the
teacher duty roster on a TV and on phones, live, and lets staff edit it in the
browser. It is a sister of the existing appointment app in `F:\appointment app`
(read it, but don't change it). Its live dashboard (`src/pages/NowPage.tsx`) is the
model: same look, same full-screen TV layout, header with the school logo, a
greeting, a big WIB clock and a QR code to the site, phone/tablet view with the
normal app header.

## Hosting and stack (hard requirements)

- Hosted on the school's cPanel (Niagahoster, user `pribadisch`), e.g.
  subdomain **duty.pribadidepok.sch.id**. **No Supabase or other third-party
  services**: the database is a **cPanel MySQL/MariaDB** database.
- cPanel runs PHP, not Node. So:
  - Front end: React 19 + Vite + TypeScript + Tailwind v4, built to static files
    (same as the appointment app; reuse its `src/index.css` `@theme` tokens, its
    `Header`/`ui.tsx` components and `design-system/sekolah-pribadi-depok/` —
    copy them in, the design-system rules in its CLAUDE.md apply here too).
  - Back end: a small **PHP 8 JSON API** (`api/*.php`), PDO with prepared
    statements only, no framework needed.
  - DB credentials live in a `config.php` **outside `public_html`** (e.g.
    `~/duty-config.php`), never in git, never in the front-end bundle.
- "Real time" = the display polls `api/version.php` every ~5 s (returns a single
  change counter / `updated_at`); it refetches the roster only when that
  changes. Do not use websockets or long-lived SSE (shared hosting kills or
  starves long PHP requests). Also refetch when the tab becomes visible again.
- Times are always Asia/Jakarta (WIB), shown as `06.45`, whatever the device
  timezone. Set the PHP and MySQL session timezone to `+07:00`.
- Deploy the same way as the appointment app: build on GitHub Actions to a
  generated `deploy` branch with linear history, server does
  `git pull && bash deploy.sh` (see that repo's CLAUDE.md "Hosting"). Write a
  `README.md` with first-time cPanel setup: create the MySQL DB + user in
  cPanel, run `sql/schema.sql` + `sql/seed.sql` in phpMyAdmin, put
  `duty-config.php` in place, set the admin password.

## The data (from "teachers duty 2.pdf", version released 19 Oct 2026)

"PRIBADI DEPOK ELEMENTARY SCHOOL — TEACHERS ON DUTY SCHEDULE — ACADEMIC YEAR
2026/2027". Rows are duties, columns are Mon–Fri, last column is a note/location.

| Time | Mon | Tue | Wed | Thu | Fri | Note |
|---|---|---|---|---|---|---|
| 06.45–07.15 | Ms. Ray | Ms. Riris | Ms. Arinda | Ms. Zahra | Ms. Bekti | Welcoming the students by the lobby door |
| 07.15–08.00 | Ms. Syifa | Ms. Nining | Ms. Anjani | Ms. Aqila | Ms. Selvia | Recording the students' tardiness |
| Break 08.05–08.25 and 13.05–13.20 | Ms. Riris | Ms. Selvia | Ms. Ray | Ms. Anjani | Ms. Aqila | Supervise indoor field |
| (same) | Mr. Gu | Mr. Fikri | Mr. Rebsam | Mr. Amir | Mr. Akbar | Supervise outdoor field |
| During prayer time | Mr. Gu | Mr. Akbar | Mr. Fikri | Mr. Amir | — | Imam |
| (same) | Ms. Nining | Ms. Aqila | Ms. Nining | Ms. Aqila | Ms. Nining | G1 ablution area (1st floor) |
| (same) | Ms. Zahra | Ms. Selvia | Ms. Selvia | Ms. Zahra | Ms. Zahra | G2 ablution area (2nd floor) |
| (same) | All teachers (Mon–Thu) | | | | All male teachers | Prayer room: Meunasah Darussalam |
| (same) | G1 & G2 homeroom teachers (Mon–Thu) | | | | — | Prayer room: G1 and G2 classroom |
| (same) | All teachers (Mon–Thu) | | | | All female teachers | Prayer room: Teacher lounge 4th floor |
| 11.30–12.00 | All homeroom teachers (Mon–Fri) | | | | | Remind students to finish food on time, tidy up after eating |
| **Afternoon duty** — Mon, Tue, Fri 14.20–15.30; Wed & Thu 14.30–15.45 | Ms. Zahra | Ms. Selvia | Ms. Syifa | Mr. Gu | Ms. Anjani | Lobby |
| (same) | Ms. Arinda | Ms. Nining | Ms. Suci | Mr. Amir | Mr. Akbar | By the automatic glass door |
| (same) | Ms. Riris | Mr. Akbar | Mr. Amir | Mr. Fikri | Mr. Fikri | 1st floor |
| (same) | Mr. Rebsam | Ms. Ray | Ms. Aqila | Mr. Rebsam | Mr. Gu | 2nd floor |
| 14.30–15.00 | Ms. Bekti | Ms. Bekti | Ms. Bekti | Ms. Bekti | Ms. Bekti | Students who are late, in the library |

Things the data model must handle (they're all in this roster):
- A duty can have **two time windows** (break: 08.05–08.25 and 13.05–13.20).
- A duty's time can **differ by weekday** (afternoon: Mon/Tue/Fri vs Wed/Thu).
- Some duties have **no fixed clock time** ("During prayer time") — let the
  admin set an approximate window (e.g. Dzuhur 11.55–12.30) so it can light up
  as "now", or mark it as untimed.
- A cell can be a person **or a group** ("All teachers", "All male teachers",
  "G1 & G2 homeroom teachers"), and a cell can span several days.
- Cells can be empty.
- Rosters are **versioned by release date** (the PDF has a 13 Jun 2026 and a
  19 Oct 2026 version). Keep old versions; the display uses the newest one whose
  "effective from" date has arrived. Admin can copy a version to start the next.
- Duties are grouped into sections (Morning, Break, Prayer, Lunch, Afternoon).

Suggested tables: `teachers` (id, name, title Ms./Mr., active), `rosters`
(id, title, effective_from), `duties` (id, roster_id, section, label/location,
note, sort), `duty_times` (duty_id, weekday nullable = every day, start, end),
`assignments` (duty_id, weekday, teacher_id nullable, group_label nullable),
`meta` (change counter bumped by every write). Put the PDF data in
`sql/seed.sql`, generated from a TypeScript/JSON source, not hand-written.

Typos in the PDF to confirm with me, don't guess silently: "Mr. Riris" and
"Ms. Rebsam" / "Mr. Ray" in the afternoon rows (I wrote them above as
Ms. Riris, Mr. Rebsam, Ms. Ray), and whether Friday "Imam" is really empty.
Ms. Suci only appears in the afternoon on Wednesday in the new version.

## Screens

1. **`/` TV display (public, no sign-in)** — today only, full screen, readable
   from across the lobby (1920×1080). Header like the appointment app's TV
   (logo, greeting "Selamat pagi", date, big WIB clock, QR to the site).
   - **"On duty now"** cards at the top: each current duty with the teacher(s),
     location and time remaining, like NowPage's cards.
   - **"Next up"**: the next duty to start and who.
   - Below: today's full list by section, the current row highlighted, past
     rows dimmed. Status never by colour alone (icon + label too).
   - Weekends / outside school hours: show Monday's roster with a clear label.
   - If the network drops, keep showing the last data with a small "offline,
     last updated 07.12" note; never a blank screen.
2. **`/week`** — the whole week as a grid like the PDF (phones: one day at a
   time with day tabs, check at 360 px wide). Filter "my duties" by picking a
   teacher name (remembered in localStorage) — this is what teachers will open
   on their phone.
3. **`/admin`** — password sign-in (PHP session, password hashed with
   `password_hash`, rate-limited wrong attempts). Edit the grid like a
   spreadsheet: click a cell → choose teacher or group from a list; edit duty
   times, notes, sections, order; manage teachers; manage roster versions and
   their effective dates; "swap for today only" (a one-day override when a
   teacher is absent, shown on the TV as a substitute). Saves update the TV
   within ~5 s.
4. Print view of the week, matching the PDF layout, for the notice board.

UI text in **both English and Bahasa Indonesia** (toggle, like the appointment
app's `src/lib/i18n.tsx`). Respect `prefers-reduced-motion`.

## Security

- All writes require the admin session + CSRF token; all reads are public but
  return only names and duties (no phone numbers, nothing private).
- Prepared statements everywhere; validate every input server-side.
- `.htaccess`: deny access to anything but `index.html`, assets and `api/`;
  SPA fallback to `index.html`.

## How to work

1. Read `F:\appointment app\CLAUDE.md`, `README.md`, `src/pages/NowPage.tsx`,
   `src/lib/live.ts`, `src/components/Header.tsx` and the design system first.
2. Propose the schema and screen list to me before coding; ask me about the
   typos above.
3. Build with a **demo mode** (data in localStorage, admin password `demo`) like
   the appointment app, so the UI works locally without PHP; `npm run dev`
   with PHP via `php -S` for the real API.
4. Write a `CLAUDE.md` for the new repo, then a new GitHub repo
   (e.g. `pribadi-school/duty-board`) — ask me before creating or pushing.
