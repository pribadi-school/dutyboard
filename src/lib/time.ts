/**
 * Time helpers. The whole app runs on Asia/Jakarta time (WIB, UTC+7, no
 * daylight saving), whatever timezone the device is set to. Times are shown
 * Indonesian style, "06.45", in both languages.
 */
import type { Lang } from './types';

export const TZ = 'Asia/Jakarta';

/** "07:15" → 435 (minutes after midnight). */
export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** 435 → "07.15" */
export const fmtMin = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}.${String(min % 60).padStart(2, '0')}`;

/** "07:15" → "07.15" */
export const fmtHm = (hhmm: string) => hhmm.slice(0, 5).replace(':', '.');

/** "07:15", "08:00" → "07.15–08.00" */
export const fmtSpan = (start: string, end: string) => `${fmtHm(start)}–${fmtHm(end)}`;

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** An instant as Jakarta wall-clock: date "2026-10-19", minutes after midnight, seconds. */
export function jakarta(ms: number) {
  const p = Object.fromEntries(partsFmt.formatToParts(ms).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute), seconds: Number(p.second) };
}

/** 07.15 for an instant. */
export const fmtClock = (ms: number) => fmtMin(jakarta(ms).minutes);

/** ISO weekday of a calendar date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string) {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** "2026-10-19" + 3 → "2026-10-22" */
export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week that contains `date` (Sat/Sun → the coming Monday). */
export function mondayOf(date: string) {
  const wd = isoWeekday(date);
  return wd >= 6 ? addDays(date, 8 - wd) : addDays(date, 1 - wd);
}

/** Monday, 19 October 2026 / Senin, 19 Oktober 2026 */
export function fmtDate(date: string, lang: Lang, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) {
  return new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-GB', { timeZone: 'UTC', ...opts }).format(new Date(`${date}T12:00:00Z`));
}

/** Weekday name for 1..5 ("Monday" / "Senin"); `short` → "Mon" / "Sen". */
export function weekdayName(wd: number, lang: Lang, short = false) {
  // 2026-10-19 is a Monday.
  return fmtDate(addDays('2026-10-19', wd - 1), lang, { weekday: short ? 'short' : 'long' });
}

/**
 * Optional clock override for checking the screens: add ?now=07:20 (today at
 * 07.20 WIB) or ?now=2026-10-21T07:20 to the URL. The clock then runs on from
 * there in real time.
 */
export function clockOffset(): number {
  if (typeof window === 'undefined') return 0;
  const v = new URLSearchParams(window.location.search).get('now');
  if (!v) return 0;
  const m = v.match(/^(?:(\d{4}-\d{2}-\d{2})[T ])?(\d{1,2})[:.](\d{2})$/);
  if (!m) return 0;
  const date = m[1] ?? jakarta(Date.now()).date;
  const target = Date.parse(`${date}T${m[2].padStart(2, '0')}:${m[3]}:00+07:00`);
  return Number.isNaN(target) ? 0 : target - Date.now();
}
