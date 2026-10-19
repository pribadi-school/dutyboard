/**
 * Demo backend: everything in this browser's localStorage, starting from the
 * seed roster (src/data/seedRoster.ts). Admin password: demo. Mirrors the
 * rules in api/admin.php (validation, "in use" checks, version bump) so the UI
 * behaves the same as on the real server. Other tabs see changes through the
 * same 5-second version poll the TV uses.
 */
import { buildSeed } from '../../data/seedRoster';
import { KEYS, load, save } from '../storage';
import { ApiError, type Assignment, type BoardData, type Duty, type ErrorCode, type Roster } from '../types';
import type { AdminAction, AdminResult, Api } from './api';

const PASSWORD = 'demo';
type Db = BoardData & { nextId: number };

function read(): Db {
  const db = load<Db | null>(KEYS.demoDb, null);
  if (db?.rosters?.length) return db;
  const seed = buildSeed();
  return { ...seed, nextId: 1000 };
}

const write = (db: Db) => save(KEYS.demoDb, db);
const fail = (code: ErrorCode): never => {
  throw new ApiError(code);
};
const delay = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 60));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const text = (v: string, max: number, allowEmpty = false) => {
  const s = v.replace(/\s+/g, ' ').trim();
  if ((!allowEmpty && !s) || s.length > max) fail('INVALID_INPUT');
  return s;
};
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

function rosterOfSection(db: Db, sectionId: number): Roster {
  return db.rosters.find((r) => r.sections.some((s) => s.id === sectionId)) ?? fail('NOT_FOUND');
}
function rosterOfDuty(db: Db, dutyId: number): [Roster, Duty] {
  for (const r of db.rosters) {
    const d = r.duties.find((x) => x.id === dutyId);
    if (d) return [r, d];
  }
  return fail('NOT_FOUND');
}
function move<T extends { id: number; sort: number }>(list: T[], id: number, dir: 1 | -1) {
  const sorted = [...list].sort((a, b) => a.sort - b.sort || a.id - b.id);
  const i = sorted.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sorted.length) return;
  [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  sorted.forEach((x, k) => (x.sort = k + 1));
}

function apply(db: Db, a: AdminAction): number | undefined {
  const newId = () => ++db.nextId;
  switch (a.action) {
    case 'teacher.save': {
      const name = text(a.name, 80);
      if (db.teachers.some((t) => t.id !== a.id && t.title === a.title && t.name.toLowerCase() === name.toLowerCase())) fail('DUPLICATE');
      if (a.id) Object.assign(db.teachers.find((t) => t.id === a.id) ?? fail('NOT_FOUND'), { title: a.title, name, active: a.active });
      else db.teachers.push({ id: newId(), title: a.title, name, active: a.active });
      return a.id ?? db.nextId;
    }
    case 'teacher.delete':
      if (db.rosters.some((r) => r.assignments.some((x) => x.teacherId === a.id)) || db.overrides.some((o) => o.teacherId === a.id)) fail('TEACHER_IN_USE');
      db.teachers = db.teachers.filter((t) => t.id !== a.id);
      return;
    case 'group.save': {
      const g = { labelEn: text(a.labelEn, 120), labelId: text(a.labelId, 120), scope: a.scope };
      if (a.id) Object.assign(db.groups.find((x) => x.id === a.id) ?? fail('NOT_FOUND'), g);
      else db.groups.push({ id: newId(), ...g });
      return a.id ?? db.nextId;
    }
    case 'group.delete':
      if (db.rosters.some((r) => r.assignments.some((x) => x.groupId === a.id))) fail('GROUP_IN_USE');
      db.groups = db.groups.filter((g) => g.id !== a.id);
      return;
    case 'roster.save': {
      if (!isDate(a.releasedOn) || !isDate(a.effectiveFrom)) fail('INVALID_INPUT');
      const meta = { title: text(a.title, 160), releasedOn: a.releasedOn, effectiveFrom: a.effectiveFrom };
      if (a.id) Object.assign(db.rosters.find((r) => r.id === a.id) ?? fail('NOT_FOUND'), meta);
      else db.rosters.push({ id: newId(), ...meta, sections: [], duties: [], assignments: [] });
      return a.id ?? db.nextId;
    }
    case 'roster.copy': {
      if (!isDate(a.releasedOn) || !isDate(a.effectiveFrom)) fail('INVALID_INPUT');
      const from = db.rosters.find((r) => r.id === a.id) ?? fail('NOT_FOUND');
      const to: Roster = { id: newId(), title: text(a.title, 160), releasedOn: a.releasedOn, effectiveFrom: a.effectiveFrom, sections: [], duties: [], assignments: [] };
      const sectionMap = new Map<number, number>();
      for (const s of from.sections) {
        const id = newId();
        sectionMap.set(s.id, id);
        to.sections.push({ ...s, id });
      }
      for (const d of from.duties) {
        const id = newId();
        to.duties.push({ ...clone(d), id, sectionId: sectionMap.get(d.sectionId)! });
        for (const x of from.assignments.filter((x) => x.dutyId === d.id)) to.assignments.push({ ...x, dutyId: id });
      }
      db.rosters.push(to);
      return to.id;
    }
    case 'roster.delete':
      if (db.rosters.length <= 1) fail('LAST_ROSTER');
      db.rosters = db.rosters.filter((r) => r.id !== a.id);
      return;
    case 'section.save': {
      const names = { nameEn: text(a.nameEn, 80), nameId: text(a.nameId, 80) };
      if (a.id) {
        const r = rosterOfSection(db, a.id);
        Object.assign(r.sections.find((s) => s.id === a.id)!, names);
        return a.id;
      }
      const r = db.rosters.find((x) => x.id === a.rosterId) ?? fail('NOT_FOUND');
      const id = newId();
      r.sections.push({ id, ...names, sort: Math.max(0, ...r.sections.map((s) => s.sort)) + 1 });
      return id;
    }
    case 'section.delete': {
      const r = rosterOfSection(db, a.id);
      const gone = new Set(r.duties.filter((d) => d.sectionId === a.id).map((d) => d.id));
      r.sections = r.sections.filter((s) => s.id !== a.id);
      r.duties = r.duties.filter((d) => !gone.has(d.id));
      r.assignments = r.assignments.filter((x) => !gone.has(x.dutyId));
      db.overrides = db.overrides.filter((o) => !gone.has(o.dutyId));
      return;
    }
    case 'section.move':
      move(rosterOfSection(db, a.id).sections, a.id, a.dir);
      return;
    case 'duty.save': {
      const r = rosterOfSection(db, a.sectionId);
      const times = a.times.map((t) => {
        if (!/^\d{2}:\d{2}$/.test(t.start) || !/^\d{2}:\d{2}$/.test(t.end) || t.end <= t.start) fail('INVALID_INPUT');
        return { weekday: t.weekday, start: t.start, end: t.end };
      });
      if (times.length > 10) fail('INVALID_INPUT');
      const fields = { label: text(a.label, 200), note: text(a.note, 300, true), timing: a.timing, times };
      const nextSort = Math.max(0, ...r.duties.filter((d) => d.sectionId === a.sectionId).map((d) => d.sort)) + 1;
      if (a.id) {
        const [r2, d] = rosterOfDuty(db, a.id);
        if (r2.id !== r.id) fail('INVALID_INPUT');
        if (d.sectionId !== a.sectionId) Object.assign(d, { sectionId: a.sectionId, sort: nextSort });
        Object.assign(d, fields);
        return a.id;
      }
      const id = newId();
      r.duties.push({ id, sectionId: a.sectionId, sort: nextSort, ...fields });
      return id;
    }
    case 'duty.delete': {
      const [r] = rosterOfDuty(db, a.id);
      r.duties = r.duties.filter((d) => d.id !== a.id);
      r.assignments = r.assignments.filter((x) => x.dutyId !== a.id);
      db.overrides = db.overrides.filter((o) => o.dutyId !== a.id);
      return;
    }
    case 'duty.move': {
      const [r, d] = rosterOfDuty(db, a.id);
      move(r.duties.filter((x) => x.sectionId === d.sectionId), a.id, a.dir);
      return;
    }
    case 'cell.set': {
      const [r] = rosterOfDuty(db, a.dutyId);
      if (!a.weekdays.length || (a.teacherId && a.groupId)) fail('INVALID_INPUT');
      if (a.teacherId && !db.teachers.some((t) => t.id === a.teacherId)) fail('INVALID_INPUT');
      if (a.groupId && !db.groups.some((g) => g.id === a.groupId)) fail('INVALID_INPUT');
      r.assignments = r.assignments.filter((x) => !(x.dutyId === a.dutyId && a.weekdays.includes(x.weekday)));
      if (a.teacherId || a.groupId) {
        for (const weekday of a.weekdays) r.assignments.push({ dutyId: a.dutyId, weekday, teacherId: a.teacherId, groupId: a.groupId } satisfies Assignment);
      }
      return;
    }
    case 'override.set': {
      if (!isDate(a.date) || !db.teachers.some((t) => t.id === a.teacherId)) fail('INVALID_INPUT');
      rosterOfDuty(db, a.dutyId);
      const note = text(a.note, 200, true);
      const existing = db.overrides.find((o) => o.date === a.date && o.dutyId === a.dutyId);
      if (existing) Object.assign(existing, { teacherId: a.teacherId, note });
      else db.overrides.push({ id: newId(), date: a.date, dutyId: a.dutyId, teacherId: a.teacherId, note });
      return;
    }
    case 'override.delete':
      db.overrides = db.overrides.filter((o) => o.id !== a.id);
      return;
    case 'password.change':
      // Demo: the password is always "demo".
      if (a.current !== PASSWORD) fail('BAD_PASSWORD');
      if (a.next.length < 8) fail('PASSWORD_TOO_SHORT');
      return;
  }
}

export function createDemoApi(): Api {
  return {
    mode: 'demo',
    version: () => delay(read().version),
    data: () => {
      const { nextId: _, ...data } = read();
      // Same order as api/data.php (ORDER BY name).
      data.teachers.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
      return delay(clone(data));
    },
    session: () => delay(load<boolean>(KEYS.adminSession, false)),
    login: async (password) => {
      await delay(null);
      if (password !== PASSWORD) fail('BAD_PASSWORD');
      save(KEYS.adminSession, true);
    },
    logout: async () => save(KEYS.adminSession, null),
    admin: async (a): Promise<AdminResult> => {
      await delay(null);
      if (!load<boolean>(KEYS.adminSession, false)) fail('NOT_SIGNED_IN');
      const db = read();
      const id = apply(db, a);
      db.version += 1;
      write(db);
      return { ok: true, version: db.version, ...(id !== undefined ? { id } : {}) };
    },
  };
}

/** Admin → Settings in demo mode: start again from the PDF roster. */
export function resetDemo() {
  save(KEYS.demoDb, null);
}
