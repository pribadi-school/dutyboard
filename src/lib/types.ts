/**
 * Shared data shapes. They mirror the MySQL tables in sql/schema.sql and the
 * JSON the PHP API returns (api/data.php), so demo mode and PHP mode look the
 * same to every screen.
 */
export type Lang = 'en' | 'id';

/** 1 = Monday … 5 = Friday (school days only). */
export type Weekday = 1 | 2 | 3 | 4 | 5;
export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5];

export type Title = 'Ms.' | 'Mr.';

export type Teacher = { id: number; title: Title; name: string; active: boolean };

/**
 * Who a group covers, so "my duties" can include e.g. "All male teachers"
 * for Mr. teachers. 'none' = a group we can't match to a person (homeroom
 * teachers: the app doesn't know who teaches which class).
 */
export type GroupScope = 'all' | 'male' | 'female' | 'none';
export type Group = { id: number; labelEn: string; labelId: string; scope: GroupScope };

/**
 * fixed = real clock times; approx = a rough window (prayer time) shown with
 * "±", still lights up as "now"; untimed = listed, never "now".
 */
export type Timing = 'fixed' | 'approx' | 'untimed';

/** One time window. weekday null = every school day, unless that day has its own rows. */
export type DutyTime = { weekday: Weekday | null; start: string; end: string };

export type Section = { id: number; nameEn: string; nameId: string; sort: number };

export type Duty = {
  id: number;
  sectionId: number;
  /** What/where, as in the PDF's last column, e.g. "Supervise indoor field". */
  label: string;
  /** Optional extra line, e.g. "Mon–Thu: …". */
  note: string;
  timing: Timing;
  sort: number;
  times: DutyTime[];
};

/** One cell: a teacher, a group, or empty (no row). */
export type Assignment = { dutyId: number; weekday: Weekday; teacherId: number | null; groupId: number | null };

export type Roster = {
  id: number;
  title: string;
  /** Date printed on the PDF ("released on"), YYYY-MM-DD. */
  releasedOn: string;
  /** The display uses the newest roster whose effectiveFrom has arrived. */
  effectiveFrom: string;
  sections: Section[];
  duties: Duty[];
  assignments: Assignment[];
};

/** "Swap for today only": on that date, the duty is done by this teacher instead. */
export type Override = { id: number; date: string; dutyId: number; teacherId: number; note: string };

/** Everything public, in one response (it's small: a few KB). */
export type BoardData = {
  version: number;
  teachers: Teacher[];
  groups: Group[];
  rosters: Roster[];
  /** From yesterday onwards. */
  overrides: Override[];
};

export type ErrorCode =
  | 'NETWORK'
  | 'UNKNOWN'
  | 'BAD_PASSWORD'
  | 'LOCKED'
  | 'NOT_SIGNED_IN'
  | 'CSRF'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'TEACHER_IN_USE'
  | 'GROUP_IN_USE'
  | 'LAST_ROSTER'
  | 'DUPLICATE'
  | 'PASSWORD_TOO_SHORT'
  | 'NOT_CONFIGURED';

const CODES: ErrorCode[] = [
  'NETWORK', 'UNKNOWN', 'BAD_PASSWORD', 'LOCKED', 'NOT_SIGNED_IN', 'CSRF', 'INVALID_INPUT', 'NOT_FOUND',
  'TEACHER_IN_USE', 'GROUP_IN_USE', 'LAST_ROSTER', 'DUPLICATE', 'PASSWORD_TOO_SHORT', 'NOT_CONFIGURED',
];

export class ApiError extends Error {
  constructor(public code: ErrorCode) {
    super(code);
  }
}

export const errorCode = (e: unknown): ErrorCode =>
  e instanceof ApiError ? e.code : e instanceof TypeError ? 'NETWORK' : CODES.includes((e as Error)?.message as ErrorCode) ? ((e as Error).message as ErrorCode) : 'UNKNOWN';
