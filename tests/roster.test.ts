import { describe, expect, it } from 'vitest';
import { buildSeed } from '../src/data/seedRoster.ts';
import { dayView, includes, rosterFor, shownDay, timeGroups, weekCells, whoText, windowsFor } from '../src/lib/roster.ts';
import { mondayOf } from '../src/lib/time.ts';
import type { BoardData, Roster } from '../src/lib/types.ts';

const data = buildSeed();
const roster = data.rosters[0];
const duty = (label: string) => roster.duties.find((d) => d.label === label)!;
const MON = '2026-10-19';
const WED = '2026-10-21';
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

describe('seed', () => {
  it('matches the PDF counts', () => {
    expect(data.teachers).toHaveLength(16);
    expect(roster.duties).toHaveLength(16);
    // 16 rows × 5 days, minus Friday Imam and Friday G1/G2 classroom.
    expect(roster.assignments).toHaveLength(78);
  });
});

describe('times', () => {
  it('break has two windows every day', () => {
    expect(windowsFor(duty('Supervise indoor field'), 3)).toEqual([
      { start: at('08:05'), end: at('08:25') },
      { start: at('13:05'), end: at('13:20') },
    ]);
  });
  it('afternoon differs Mon/Tue/Fri vs Wed/Thu', () => {
    const d = duty('Lobby');
    expect(windowsFor(d, 1)).toEqual([{ start: at('14:20'), end: at('15:30') }]);
    expect(windowsFor(d, 4)).toEqual([{ start: at('14:30'), end: at('15:45') }]);
    expect(timeGroups(d).map((g) => g.weekdays)).toEqual([[1, 2, 5], [3, 4]]);
  });
});

describe('day view', () => {
  it('lights up the break duty in the second window', () => {
    const day = dayView(data, WED, at('13:10'))!;
    const now = day.rows.filter((r) => r.state === 'now').map((r) => r.duty.label);
    expect(now).toEqual(['Supervise indoor field', 'Supervise outdoor field']);
    expect(whoText(day.rows.find((r) => r.duty.label === 'Supervise indoor field')!.who, 'en')).toBe('Ms. Ray');
  });
  it('marks the next duty to start', () => {
    const day = dayView(data, MON, at('07:00'))!;
    expect(day.rows.filter((r) => r.state === 'next').map((r) => r.duty.label)).toEqual(["Recording the students' tardiness"]);
  });
  it('approximate prayer time counts as now; Friday Imam is empty', () => {
    const fri = dayView(data, '2026-10-23', at('12:00'))!;
    const imam = fri.rows.find((r) => r.duty.label === 'Imam')!;
    expect(imam.state).toBe('now');
    expect(imam.who).toBeNull();
  });
  it('a swap replaces the teacher for that date only', () => {
    const d = duty('Lobby');
    const withSwap: BoardData = { ...data, overrides: [{ id: 1, date: MON, dutyId: d.id, teacherId: data.teachers.find((t) => t.name === 'Suci')!.id, note: '' }] };
    const mon = dayView(withSwap, MON, at('14:30'))!.rows.find((r) => r.duty.id === d.id)!;
    expect(whoText(mon.who, 'en')).toBe('Ms. Suci');
    expect(mon.who?.planned?.teacher?.name).toBe('Zahra');
    const tue = dayView(withSwap, '2026-10-20', at('14:30'))!.rows.find((r) => r.duty.id === d.id)!;
    expect(whoText(tue.who, 'en')).toBe('Ms. Selvia');
  });
});

describe('shown day', () => {
  it('weekend shows Monday; after hours shows the next school day', () => {
    expect(shownDay(data, '2026-10-24', at('10:00'))).toEqual({ date: '2026-10-26', reason: 'weekend' });
    expect(shownDay(data, '2026-10-23', at('16:00'))).toEqual({ date: '2026-10-26', reason: 'afterHours' });
    expect(shownDay(data, MON, at('06:00'))).toEqual({ date: MON, reason: 'today' });
    expect(mondayOf('2026-10-25')).toBe('2026-10-26');
  });
});

describe('versions', () => {
  it('uses the newest version that has started', () => {
    const june: Roster = { ...roster, id: 9, effectiveFrom: '2026-06-13' };
    const next: Roster = { ...roster, id: 10, effectiveFrom: '2027-01-04' };
    expect(rosterFor([june, roster, next], '2026-10-20')?.id).toBe(roster.id);
    expect(rosterFor([june, roster, next], '2026-07-01')?.id).toBe(9);
    expect(rosterFor([june, roster, next], '2027-01-04')?.id).toBe(10);
  });
});

describe('groups', () => {
  it('merges neighbouring days with the same group', () => {
    const cells = weekCells(data, roster, duty('Prayer room: Meunasah Darussalam').id);
    expect(cells.map((c) => c.weekdays)).toEqual([[1, 2, 3, 4], [5]]);
    expect(whoText(cells[1].who, 'id')).toBe('Semua guru laki-laki');
  });
  it('"my duties" includes groups that cover me', () => {
    const gu = data.teachers.find((t) => t.name === 'Gu')!;
    const fri = weekCells(data, roster, duty('Prayer room: Teacher lounge (4th floor)').id);
    expect(includes(fri[0].who, gu)).toBe(true); // All teachers, Mon–Thu
    expect(includes(fri[1].who, gu)).toBe(false); // All female teachers
  });
});
