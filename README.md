# Teachers on Duty — SD Pribadi Depok

Shows the teacher duty roster live on the lobby TV and on teachers' phones,
and lets the office edit it in the browser.

| Page | Who | What |
|---|---|---|
| `/` | Lobby TV (public) | “On duty now” cards, “Next up”, today's list (current row highlighted, past rows dimmed), WIB clock. Weekends and after the last duty: the next school day, with a label. |
| `/week` | Teachers' phones (public) | The whole week like the PDF. Pick your name under **My duties** (remembered on the phone) to star your cells, including “All teachers” / “All male teachers”. Phones show one day at a time. |
| `/print` | Office | The roster laid out like the printed PDF (A4 landscape) for the notice board. |
| `/admin` | Office (password) | Edit the grid like a spreadsheet, **swap for one day** when a teacher is absent, teachers and groups, roster versions. |

English and Bahasa Indonesia (EN | ID toggle; a TV can use `/?lang=id`).
Times are always WIB, shown as `06.45`.

## How “live” works

Every screen checks `api/version.php` every 5 seconds (a tiny response: one
number that every admin save increases). Only when it changes does the screen
fetch the roster again (`api/data.php`, a few KB). It also refreshes when a tab
becomes visible again. No websockets or long connections: shared hosting cuts
those off. If the network drops, the TV keeps showing the last roster with
“Offline · last updated 07.12”, never a blank screen.

## The data

Rows are **duties** grouped in **sections** (Morning, Break time, Prayer time,
Lunch, Afternoon); columns are Mon–Fri. The model covers everything in the
19 Oct 2026 roster:

- **Two time windows** for one duty (break: 08.05–08.25 and 13.05–13.20).
- **Different times per weekday** (afternoon: Mon/Tue/Fri 14.20–15.30, Wed/Thu 14.30–15.45).
- **No fixed time** (prayer): a duty is *Fixed*, *Approximate* (shown as
  “± 11.55–12.30” and still lights up as “On duty now”) or *No fixed time*.
- **Groups** in cells (“All teachers”, “All male teachers”, “G1 & G2 homeroom
  teachers”); neighbouring days with the same group are shown as one wide cell.
- **Empty cells** (Friday Imam is empty on purpose).
- **Versions** (the PDF had a 13 Jun and a 19 Oct 2026 version): each roster
  has an *in use from* date; the screens use the newest one that has started.
  To prepare a new term: Admin → Versions → *Copy as new version*, set its
  date, edit it. Old versions are kept.
- **Swaps for one day**: a substitute on a date; the planned roster stays.

Tables: see [sql/schema.sql](sql/schema.sql). The starting roster is typed in
[src/data/seedRoster.ts](src/data/seedRoster.ts); `npm run seed:generate` turns
it into `sql/seed.sql` (never edit that by hand). After go-live, the roster is
edited in `/admin`, not in code.

**To check in /admin after go-live:** the PDF's afternoon rows print
“Mr. Riris”, “Ms. Rebsam” and “Mr. Ray”. They were seeded as the same teachers
as in the other rows (Ms. Riris, Mr. Rebsam, Ms. Ray). If any of them is
really someone else, add that teacher and change those cells.

## Stack

- Front end: React 19 + Vite + TypeScript + Tailwind v4, built to static files.
  Shares the school design system with the appointment app
  (`design-system/sekolah-pribadi-depok/`).
- Back end: PHP 8.1+ JSON API in `api/` (PDO, prepared statements only, no
  framework) and a MySQL / MariaDB database from cPanel.
- No third-party services.

## Local development

```bash
npm install
npm run dev        # http://localhost:5173 in demo mode
```

**Demo mode** keeps everything in this browser's storage, starting from the
PDF roster; the admin password is `demo`. It is what `npm run dev` uses, so the
UI works without PHP or MySQL. Admin → Settings → *Reset demo data* starts over.

Add `?now=07:20` (or `?now=2026-10-21T13:10`) to any URL to see the screens
as if it were that time.

**With the real PHP API** (needs PHP 8.1+ with pdo_mysql, and a local MySQL/MariaDB):

1. Create a database, run `sql/schema.sql` then `sql/seed.sql`.
2. Copy `duty-config.example.php` to `duty-config.local.php` (git-ignored) and fill it in.
3. `php tools/set-password.php` with `DUTY_CONFIG` pointing at that file, or
   insert a `password_hash()` into `meta` as `admin_password_hash`.
4. In two terminals: `npm run php` (PHP on :8000) and `npm run dev:php` (Vite, proxies `/api`).

Tests: `npm test` (roster logic: windows, weekdays, swaps, versions, groups).
Build: `npm run build` (type-check + production build, always the PHP API).

## Hosting (cPanel, Niagahoster, user `pribadisch`)

Live at **duty.pribadidepok.sch.id**, folder `public_html/duty`.
cPanel can't build, so GitHub Actions builds every push to `main` onto a
generated `deploy` branch (linear history, never force-pushed). The server has
a clone of that branch outside `public_html`; `deploy.sh` copies the site files
in.

### First-time setup

1. **Subdomain** — cPanel → Domains: create `duty.pribadidepok.sch.id` with
   document root `public_html/duty`. Turn on SSL (AutoSSL / Let's Encrypt).
2. **PHP** — cPanel → MultiPHP Manager: PHP 8.1 or newer for that subdomain
   (`pdo_mysql` is on by default).
3. **Database** — cPanel → MySQL Databases:
   - create a database, e.g. `pribadisch_duty`;
   - create a user, e.g. `pribadisch_duty`, with a long random password;
   - add the user to the database with **All privileges**.
4. **Tables and roster** — cPanel → phpMyAdmin → select that database →
   *Import* `sql/schema.sql`, then *Import* `sql/seed.sql` (both from this repo).
   The seed is for an empty database only; on a second run it stops with
   “Duplicate entry” and changes nothing.
5. **Config** — cPanel → File Manager → your **home folder** (`/home/pribadisch`,
   *not* `public_html`): create `duty-config.php` from
   [duty-config.example.php](duty-config.example.php) with the database name,
   user and password. Permissions `600`. The API finds it by looking in the
   folders above the site. Never commit it.
6. **Code** — cPanel → Terminal:

   ```bash
   git clone -b deploy https://github.com/pribadi-school/dutyboard.git ~/repositories/dutyboard
   ```

   ```bash
   cd ~/repositories/dutyboard && bash deploy.sh
   ```

7. **Admin password** — cPanel → Terminal (asks twice, not shown while typing;
   stores only a hash):

   ```bash
   php ~/repositories/dutyboard/tools/set-password.php
   ```

8. Open `https://duty.pribadidepok.sch.id/admin`, sign in, check the roster.
   On the lobby TV open `https://duty.pribadidepok.sch.id/` full screen (F11).

### Releasing a change

1. Commit and push to `main`. GitHub Actions runs the tests and `npm run deploy`.
2. cPanel → Terminal:

   ```bash
   cd ~/repositories/dutyboard && git pull && bash deploy.sh
   ```

A forgotten admin password: run step 7 again.

## Privacy and security

- Reads are public and return only names and duties (no phone numbers,
  nothing private).
- Every write needs the admin session (PHP session cookie: HttpOnly,
  SameSite=Strict, Secure on HTTPS) **and** the CSRF token from sign-in. Every
  field is validated on the server; all SQL uses prepared statements.
- Sign-in: password checked with `password_verify`; 5 wrong tries from one IP
  lock it for 10 minutes. Sessions end after 12 hours idle.
- DB credentials live only in `~/duty-config.php`, outside the web root; never
  in git or the front-end bundle.
- `.htaccess` serves only `index.html`, `assets/`, the icons and `api/*.php`;
  everything else on disk is a 404, any other path is the app.

## Troubleshooting

| Symptom | Check |
|---|---|
| “The server isn't set up yet” | `~/duty-config.php` exists and is readable; the admin password was set (step 7). |
| TV shows “Offline” | The TV's network; it retries every 5 s and keeps the last roster meanwhile. |
| Changes don't show on the TV | Did the save show “Saved”? The TV updates within ~5 s; a reload also works. |
| A page says 404 after a release | Run `deploy.sh` again (it copies `.htaccess` too). |
