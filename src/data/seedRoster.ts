/**
 * The roster as printed in "teachers duty 2.pdf" (version released 19 Oct 2026):
 * PRIBADI DEPOK ELEMENTARY SCHOOL — TEACHERS ON DUTY SCHEDULE — 2026/2027.
 *
 * This is the single source for the starting data: `npm run seed:generate`
 * turns it into sql/seed.sql (never hand-edit that file), and demo mode loads
 * it directly. After go-live the roster is edited in /admin, not here.
 *
 * Cells: "Ms. Ray" = a teacher (must be in TEACHERS), "@key" = a group, null = empty.
 *
 * Checked with the school (19 Oct 2026):
 * - The PDF's afternoon rows print "Mr. Riris", "Ms. Rebsam" and "Mr. Ray".
 *   Seeded as the same teachers as elsewhere (Ms. Riris, Mr. Rebsam, Ms. Ray);
 *   the school will correct them in /admin if any of them is someone else.
 * - Friday "Imam" is empty on purpose.
 * - "During prayer time" has no clock time; seeded as an approximate Dzuhur
 *   window 11.55–12.30 so it can show as "now". Change it in /admin.
 */
import type { Assignment, BoardData, DutyTime, Group, GroupScope, Roster, Teacher, Timing, Title, Weekday } from '../lib/types.ts';

type Cell = string | null;
type SeedDuty = { label: string; note?: string; timing?: Timing; times: DutyTime[]; cells: [Cell, Cell, Cell, Cell, Cell] };
type SeedSection = { nameEn: string; nameId: string; duties: SeedDuty[] };

export const TEACHERS: [Title, string][] = [
  ['Ms.', 'Ray'],
  ['Ms.', 'Riris'],
  ['Ms.', 'Arinda'],
  ['Ms.', 'Zahra'],
  ['Ms.', 'Bekti'],
  ['Ms.', 'Syifa'],
  ['Ms.', 'Nining'],
  ['Ms.', 'Anjani'],
  ['Ms.', 'Aqila'],
  ['Ms.', 'Selvia'],
  ['Ms.', 'Suci'],
  ['Mr.', 'Gu'],
  ['Mr.', 'Fikri'],
  ['Mr.', 'Rebsam'],
  ['Mr.', 'Amir'],
  ['Mr.', 'Akbar'],
];

export const GROUPS: { key: string; labelEn: string; labelId: string; scope: GroupScope }[] = [
  { key: 'all', labelEn: 'All teachers', labelId: 'Semua guru', scope: 'all' },
  { key: 'male', labelEn: 'All male teachers', labelId: 'Semua guru laki-laki', scope: 'male' },
  { key: 'female', labelEn: 'All female teachers', labelId: 'Semua guru perempuan', scope: 'female' },
  { key: 'g12home', labelEn: 'G1 & G2 homeroom teachers', labelId: 'Wali kelas G1 & G2', scope: 'none' },
  { key: 'home', labelEn: 'All homeroom teachers', labelId: 'Semua wali kelas', scope: 'none' },
];

const every = (start: string, end: string): DutyTime => ({ weekday: null, start, end });
const on = (days: Weekday[], start: string, end: string): DutyTime[] => days.map((weekday) => ({ weekday, start, end }));

const BREAK = [every('08:05', '08:25'), every('13:05', '13:20')];
// Prayer time has no clock time on the PDF: an approximate Dzuhur window.
const PRAYER = [every('11:55', '12:30')];
const AFTERNOON = [...on([1, 2, 5], '14:20', '15:30'), ...on([3, 4], '14:30', '15:45')];

export const ROSTER: { title: string; releasedOn: string; effectiveFrom: string; sections: SeedSection[] } = {
  title: 'Academic Year 2026/2027',
  releasedOn: '2026-10-19',
  effectiveFrom: '2026-10-19',
  sections: [
    {
      nameEn: 'Morning',
      nameId: 'Pagi',
      duties: [
        { label: 'Welcoming the students by the lobby door', times: [every('06:45', '07:15')], cells: ['Ms. Ray', 'Ms. Riris', 'Ms. Arinda', 'Ms. Zahra', 'Ms. Bekti'] },
        { label: "Recording the students' tardiness", times: [every('07:15', '08:00')], cells: ['Ms. Syifa', 'Ms. Nining', 'Ms. Anjani', 'Ms. Aqila', 'Ms. Selvia'] },
      ],
    },
    {
      nameEn: 'Break time',
      nameId: 'Istirahat',
      duties: [
        { label: 'Supervise indoor field', times: BREAK, cells: ['Ms. Riris', 'Ms. Selvia', 'Ms. Ray', 'Ms. Anjani', 'Ms. Aqila'] },
        { label: 'Supervise outdoor field', times: BREAK, cells: ['Mr. Gu', 'Mr. Fikri', 'Mr. Rebsam', 'Mr. Amir', 'Mr. Akbar'] },
      ],
    },
    {
      nameEn: 'Prayer time',
      nameId: 'Waktu salat',
      duties: [
        // Friday empty on purpose (confirmed).
        { label: 'Imam', timing: 'approx', times: PRAYER, cells: ['Mr. Gu', 'Mr. Akbar', 'Mr. Fikri', 'Mr. Amir', null] },
        { label: 'G1 ablution area (1st floor)', timing: 'approx', times: PRAYER, cells: ['Ms. Nining', 'Ms. Aqila', 'Ms. Nining', 'Ms. Aqila', 'Ms. Nining'] },
        { label: 'G2 ablution area (2nd floor)', timing: 'approx', times: PRAYER, cells: ['Ms. Zahra', 'Ms. Selvia', 'Ms. Selvia', 'Ms. Zahra', 'Ms. Zahra'] },
        { label: 'Prayer room: Meunasah Darussalam', timing: 'approx', times: PRAYER, cells: ['@all', '@all', '@all', '@all', '@male'] },
        { label: 'Prayer room: G1 and G2 classroom', timing: 'approx', times: PRAYER, cells: ['@g12home', '@g12home', '@g12home', '@g12home', null] },
        { label: 'Prayer room: Teacher lounge (4th floor)', timing: 'approx', times: PRAYER, cells: ['@all', '@all', '@all', '@all', '@female'] },
      ],
    },
    {
      nameEn: 'Lunch',
      nameId: 'Makan siang',
      duties: [
        {
          label: 'Remind students to finish their food on time and tidy up after eating',
          times: [every('11:30', '12:00')],
          cells: ['@home', '@home', '@home', '@home', '@home'],
        },
      ],
    },
    {
      nameEn: 'Afternoon',
      nameId: 'Pulang sekolah',
      duties: [
        { label: 'Lobby', times: AFTERNOON, cells: ['Ms. Zahra', 'Ms. Selvia', 'Ms. Syifa', 'Mr. Gu', 'Ms. Anjani'] },
        { label: 'By the automatic glass door', times: AFTERNOON, cells: ['Ms. Arinda', 'Ms. Nining', 'Ms. Suci', 'Mr. Amir', 'Mr. Akbar'] },
        // PDF prints "Mr. Riris" (Mon): seeded as Ms. Riris, to confirm in /admin.
        { label: '1st floor', times: AFTERNOON, cells: ['Ms. Riris', 'Mr. Akbar', 'Mr. Amir', 'Mr. Fikri', 'Mr. Fikri'] },
        // PDF prints "Ms. Rebsam" (Mon) and "Mr. Ray" (Tue): seeded as Mr. Rebsam and Ms. Ray, to confirm in /admin.
        { label: '2nd floor', times: AFTERNOON, cells: ['Mr. Rebsam', 'Ms. Ray', 'Ms. Aqila', 'Mr. Rebsam', 'Mr. Gu'] },
        { label: 'Students who are late, in the library', times: [every('14:30', '15:00')], cells: ['Ms. Bekti', 'Ms. Bekti', 'Ms. Bekti', 'Ms. Bekti', 'Ms. Bekti'] },
      ],
    },
  ],
};

/** The seed with numeric ids (1, 2, 3 … in order), exactly as seed.sql inserts it. */
export function buildSeed(): BoardData {
  const teachers: Teacher[] = TEACHERS.map(([title, name], i) => ({ id: i + 1, title, name, active: true }));
  const groups: Group[] = GROUPS.map((g, i) => ({ id: i + 1, labelEn: g.labelEn, labelId: g.labelId, scope: g.scope }));
  const teacherId = new Map(teachers.map((t) => [`${t.title} ${t.name}`, t.id]));
  const groupId = new Map(GROUPS.map((g, i) => [g.key, i + 1]));

  const roster: Roster = { id: 1, title: ROSTER.title, releasedOn: ROSTER.releasedOn, effectiveFrom: ROSTER.effectiveFrom, sections: [], duties: [], assignments: [] };
  let dutyId = 0;
  ROSTER.sections.forEach((s, si) => {
    const sectionId = si + 1;
    roster.sections.push({ id: sectionId, nameEn: s.nameEn, nameId: s.nameId, sort: si + 1 });
    s.duties.forEach((d, di) => {
      const id = ++dutyId;
      roster.duties.push({ id, sectionId, label: d.label, note: d.note ?? '', timing: d.timing ?? 'fixed', sort: di + 1, times: d.times });
      d.cells.forEach((cell, ci) => {
        if (cell === null) return;
        const weekday = (ci + 1) as Weekday;
        const a: Assignment = { dutyId: id, weekday, teacherId: null, groupId: null };
        if (cell.startsWith('@')) {
          a.groupId = groupId.get(cell.slice(1)) ?? fail(`Unknown group ${cell}`);
        } else {
          a.teacherId = teacherId.get(cell) ?? fail(`Unknown teacher "${cell}" (add them to TEACHERS)`);
        }
        roster.assignments.push(a);
      });
    });
  });
  return { version: 1, teachers, groups, rosters: [roster], overrides: [] };
}

function fail(msg: string): never {
  throw new Error(msg);
}
