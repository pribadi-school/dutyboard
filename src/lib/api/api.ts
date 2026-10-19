/**
 * The backend contract. Two implementations: phpApi.ts (the real PHP API in
 * api/*.php) and demoApi.ts (this browser's storage). Anything added to one
 * must be added to the other, and to api/admin.php.
 */
import type { BoardData, DutyTime, GroupScope, Timing, Title, Weekday } from '../types';

export type AdminAction =
  | { action: 'teacher.save'; id?: number; title: Title; name: string; active: boolean }
  | { action: 'teacher.delete'; id: number }
  | { action: 'group.save'; id?: number; labelEn: string; labelId: string; scope: GroupScope }
  | { action: 'group.delete'; id: number }
  | { action: 'roster.save'; id?: number; title: string; releasedOn: string; effectiveFrom: string }
  | { action: 'roster.copy'; id: number; title: string; releasedOn: string; effectiveFrom: string }
  | { action: 'roster.delete'; id: number }
  | { action: 'section.save'; id?: number; rosterId?: number; nameEn: string; nameId: string }
  | { action: 'section.delete'; id: number }
  | { action: 'section.move'; id: number; dir: 1 | -1 }
  | { action: 'duty.save'; id?: number; sectionId: number; label: string; note: string; timing: Timing; times: DutyTime[] }
  | { action: 'duty.delete'; id: number }
  | { action: 'duty.move'; id: number; dir: 1 | -1 }
  | { action: 'cell.set'; dutyId: number; weekdays: Weekday[]; teacherId: number | null; groupId: number | null }
  | { action: 'override.set'; date: string; dutyId: number; teacherId: number; note: string }
  | { action: 'override.delete'; id: number }
  | { action: 'password.change'; current: string; next: string };

export type AdminResult = { ok: true; version: number; id?: number };

export interface Api {
  mode: 'php' | 'demo';
  /** The change counter; cheap, polled every ~5 s. */
  version(): Promise<number>;
  data(): Promise<BoardData>;
  /** Is this browser signed in as admin? */
  session(): Promise<boolean>;
  login(password: string): Promise<void>;
  logout(): Promise<void>;
  admin(a: AdminAction): Promise<AdminResult>;
}
