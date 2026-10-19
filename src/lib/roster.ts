/**
 * Roster logic shared by every screen: which version applies on a date, a
 * duty's time windows on a weekday, who is on a cell (with "today only"
 * swaps), what's on now / next, and "does this cell include me".
 */
import { addDays, isoWeekday, toMin } from './time';
import type { Assignment, BoardData, Duty, Group, Lang, Override, Roster, Section, Teacher, Weekday } from './types';

export const teacherName = (t: Pick<Teacher, 'title' | 'name'>) => `${t.title} ${t.name}`;
export const groupLabel = (g: Group, lang: Lang) => (lang === 'id' ? g.labelId : g.labelEn);
export const sectionName = (s: Section, lang: Lang) => (lang === 'id' ? s.nameId : s.nameEn);

const byId = <T extends { id: number }>(list: T[]) => new Map(list.map((x) => [x.id, x]));

/** The version in force on `date`: the newest whose effectiveFrom has arrived (else the oldest). */
export function rosterFor(rosters: Roster[], date: string): Roster | undefined {
  const sorted = [...rosters].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.id - a.id);
  return sorted.find((r) => r.effectiveFrom <= date) ?? sorted[sorted.length - 1];
}

export const sortedSections = (r: Roster) => [...r.sections].sort((a, b) => a.sort - b.sort || a.id - b.id);
export const dutiesOf = (r: Roster, sectionId: number) => r.duties.filter((d) => d.sectionId === sectionId).sort((a, b) => a.sort - b.sort || a.id - b.id);

export type Window = { start: number; end: number };

/** A duty's windows on a weekday: that day's own rows if it has any, else the every-day rows. */
export function windowsFor(duty: Duty, wd: Weekday): Window[] {
  const own = duty.times.filter((t) => t.weekday === wd);
  return (own.length ? own : duty.times.filter((t) => t.weekday === null))
    .map((t) => ({ start: toMin(t.start), end: toMin(t.end) }))
    .sort((a, b) => a.start - b.start);
}

export const cellOf = (r: Roster, dutyId: number, wd: Weekday): Assignment | undefined => r.assignments.find((a) => a.dutyId === dutyId && a.weekday === wd);

/** Who is on a cell. `substitute` set when a "today only" swap replaces the planned teacher/group. */
export type Who = {
  teacher?: Teacher;
  group?: Group;
  /** The planned teacher or group when a swap is in force. */
  planned?: { teacher?: Teacher; group?: Group };
  override?: Override;
};

export function whoOn(data: BoardData, r: Roster, dutyId: number, wd: Weekday, date?: string): Who | null {
  const teachers = byId(data.teachers);
  const groups = byId(data.groups);
  const a = cellOf(r, dutyId, wd);
  const planned = a ? { teacher: a.teacherId ? teachers.get(a.teacherId) : undefined, group: a.groupId ? groups.get(a.groupId) : undefined } : undefined;
  const o = date ? data.overrides.find((x) => x.date === date && x.dutyId === dutyId) : undefined;
  const sub = o && teachers.get(o.teacherId);
  if (o && sub) return { teacher: sub, planned, override: o };
  if (!planned || (!planned.teacher && !planned.group)) return null;
  return planned;
}

export function whoText(w: Who | null, lang: Lang): string {
  if (!w) return '—';
  return w.teacher ? teacherName(w.teacher) : w.group ? groupLabel(w.group, lang) : '—';
}

export function plannedText(w: Who, lang: Lang): string {
  return whoText(w.planned ? { ...w.planned } : null, lang);
}

/** Does this cell include teacher `me` (by name, or a group that covers them)? */
export function includes(w: Who | null, me: Teacher | undefined): boolean {
  if (!w || !me) return false;
  if (w.teacher) return w.teacher.id === me.id;
  const scope = w.group?.scope;
  return scope === 'all' || (scope === 'male' && me.title === 'Mr.') || (scope === 'female' && me.title === 'Ms.');
}

export type RowState = 'now' | 'next' | 'later' | 'past' | 'untimed';

export type DayRow = {
  duty: Duty;
  section: Section;
  windows: Window[];
  who: Who | null;
  /** The window running at `now`, if any. */
  current?: Window;
  /** The next window that hasn't started. */
  upcoming?: Window;
  state: RowState;
};

export type Day = { date: string; weekday: Weekday; roster: Roster; sections: { section: Section; rows: DayRow[] }[]; rows: DayRow[] };

/**
 * One school day's roster with each row's state at `nowMin` (minutes after
 * midnight; pass -1 for "before the day starts", e.g. a future day).
 */
export function dayView(data: BoardData, date: string, nowMin: number): Day | null {
  const wd = isoWeekday(date);
  if (wd > 5) return null;
  const weekday = wd as Weekday;
  const roster = rosterFor(data.rosters, date);
  if (!roster) return null;
  const rows: DayRow[] = [];
  const sections = sortedSections(roster).map((section) => {
    const list = dutiesOf(roster, section.id).map((duty): DayRow => {
      const windows = windowsFor(duty, weekday);
      const who = whoOn(data, roster, duty.id, weekday, date);
      const timed = duty.timing !== 'untimed' && windows.length > 0;
      const current = timed ? windows.find((w) => nowMin >= w.start && nowMin < w.end) : undefined;
      const upcoming = timed ? windows.find((w) => w.start > nowMin) : undefined;
      const state: RowState = !timed ? 'untimed' : current ? 'now' : upcoming ? 'later' : 'past';
      return { duty, section, windows, who, current, upcoming, state };
    });
    rows.push(...list);
    return { section, rows: list };
  });
  // "Next": the row(s) with the soonest start that's still ahead and staffed.
  const soonest = Math.min(...rows.filter((r) => r.state !== 'now' && r.upcoming && r.who).map((r) => r.upcoming!.start));
  for (const r of rows) if (r.state === 'later' && r.who && r.upcoming?.start === soonest) r.state = 'next';
  return { date, weekday, roster, sections, rows };
}

/** When a school day ends (last timed window), in minutes; 0 if nothing is timed. */
export function dayEnd(day: Day): number {
  return Math.max(0, ...day.rows.filter((r) => r.duty.timing !== 'untimed').flatMap((r) => r.windows.map((w) => w.end)));
}

export type ShownDay = { date: string; reason: 'today' | 'weekend' | 'afterHours' };

/**
 * Which day the TV shows: today on a school day until its last duty ends;
 * after that the next school day; on Saturday/Sunday, Monday.
 */
export function shownDay(data: BoardData, today: string, nowMin: number): ShownDay {
  const wd = isoWeekday(today);
  const nextSchoolDay = (d: string) => {
    let x = addDays(d, 1);
    while (isoWeekday(x) > 5) x = addDays(x, 1);
    return x;
  };
  if (wd > 5) return { date: nextSchoolDay(today), reason: 'weekend' };
  const day = dayView(data, today, nowMin);
  if (day && nowMin >= dayEnd(day)) return { date: nextSchoolDay(today), reason: 'afterHours' };
  return { date: today, reason: 'today' };
}

/**
 * A row of the week grid, with neighbouring days merged when they hold the same
 * group (e.g. "All teachers" Mon–Thu), like the printed PDF.
 */
export type WeekCell = { weekdays: Weekday[]; who: Who | null };

export function weekCells(data: BoardData, r: Roster, dutyId: number, date?: (wd: Weekday) => string): WeekCell[] {
  const out: WeekCell[] = [];
  for (const wd of [1, 2, 3, 4, 5] as Weekday[]) {
    const who = whoOn(data, r, dutyId, wd, date?.(wd));
    const last = out[out.length - 1];
    if (last && who?.group && !who.override && last.who?.group?.id === who.group.id && !last.who.override) last.weekdays.push(wd);
    else out.push({ weekdays: [wd], who });
  }
  return out;
}

/** Time label of a duty for the week grid: shared windows, or per-day when they differ. */
export function timeGroups(duty: Duty): { weekdays: Weekday[]; windows: Window[] }[] {
  const out: { weekdays: Weekday[]; windows: Window[] }[] = [];
  for (const wd of [1, 2, 3, 4, 5] as Weekday[]) {
    const w = windowsFor(duty, wd);
    const key = JSON.stringify(w);
    const same = out.find((g) => JSON.stringify(g.windows) === key);
    if (same) same.weekdays.push(wd);
    else out.push({ weekdays: [wd], windows: w });
  }
  return out;
}
