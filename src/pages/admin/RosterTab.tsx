/**
 * Admin → Roster: the week grid of one version, edited like a spreadsheet.
 * Click a cell → pick a teacher, a group or empty (optionally for several
 * days at once). Click a duty → edit its name, section, timing and time
 * windows. Sections and rows can be added, renamed, reordered, deleted.
 */
import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { Button, Field, Notice, SelectField, Segmented, cx } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { cellOf, dutiesOf, groupLabel, rosterFor, sectionName, sortedSections, teacherName } from '../../lib/roster';
import { fmtDate, weekdayName } from '../../lib/time';
import { WEEKDAYS, type Duty, type DutyTime, type Roster, type Section, type Timing, type Weekday } from '../../lib/types';
import { WeekTime } from '../WeekPage';
import { VersionTag, useAdmin } from './AdminPage';

export function versionStatus(rosters: Roster[], r: Roster, today: string): 'current' | 'upcoming' | 'old' {
  if (rosterFor(rosters, today)?.id === r.id) return 'current';
  return r.effectiveFrom > today ? 'upcoming' : 'old';
}

const shortDate = (d: string, lang: 'en' | 'id') => fmtDate(d, lang, { day: 'numeric', month: 'short', year: 'numeric' });

export function RosterTab({ roster, onPick }: { roster: Roster; onPick: (id: number) => void }) {
  const { t, lang } = useI18n();
  const { data, today, run } = useAdmin();
  const [cell, setCell] = useState<{ duty: Duty; weekday: Weekday } | null>(null);
  const [duty, setDuty] = useState<{ duty?: Duty; sectionId: number } | null>(null);
  const [section, setSection] = useState<Section | 'new' | null>(null);
  const status = versionStatus(data.rosters, roster, today);
  const inUse = rosterFor(data.rosters, today)!;
  const sections = sortedSections(roster);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <SelectField
          className="sm:w-96"
          label={t('a_version')}
          value={String(roster.id)}
          onChange={(v) => onPick(Number(v))}
          options={[...data.rosters]
            .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
            .map((r) => ({ value: String(r.id), label: `${r.title} · ${shortDate(r.effectiveFrom, lang)}` }))}
        />
        <div className="pb-3">
          <VersionTag status={status} date={shortDate(roster.effectiveFrom, lang)} />
        </div>
      </div>
      {status !== 'current' && (
        <div className="mt-4">
          <Notice>{t('a_editingOld', { title: inUse.title, date: shortDate(inUse.effectiveFrom, lang) })}</Notice>
        </div>
      )}
      <p className="mt-4 text-sm text-muted-foreground">{t('a_cellHelp')}</p>

      <div className="mt-3 overflow-x-auto rounded-lg border border-border-strong bg-surface">
        <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border-strong bg-surface-muted">
              <th scope="col" className="w-56 px-3 py-3 font-semibold text-muted-foreground">{t('week_duty')}</th>
              <th scope="col" className="w-36 px-3 py-3 font-semibold text-muted-foreground">{t('week_time')}</th>
              {WEEKDAYS.map((wd) => (
                <th key={wd} scope="col" className="px-2 py-3 font-semibold text-foreground">{weekdayName(wd, lang)}</th>
              ))}
              <th scope="col" className="w-24 px-2 py-3"><span className="sr-only">{t('a_moveUp')}</span></th>
            </tr>
          </thead>
          <tbody>
            {sections.map((s, si) => {
              const rows = dutiesOf(roster, s.id);
              return [
                <tr key={`s${s.id}`} className="border-b border-border-strong bg-surface-page">
                  <th colSpan={9} scope="colgroup" className="px-3 py-1.5">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="mr-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">{sectionName(s, lang)}</span>
                      <IconBtn label={t('a_editSection')} onClick={() => setSection(s)}><Pencil className="size-4" /></IconBtn>
                      <IconBtn label={t('a_moveUp')} disabled={si === 0} onClick={() => run({ action: 'section.move', id: s.id, dir: -1 })}><ArrowUp className="size-4" /></IconBtn>
                      <IconBtn label={t('a_moveDown')} disabled={si === sections.length - 1} onClick={() => run({ action: 'section.move', id: s.id, dir: 1 })}><ArrowDown className="size-4" /></IconBtn>
                      <Button variant="ghost" size="sm" className="ml-auto" icon={<Plus className="size-4" aria-hidden />} onClick={() => setDuty({ sectionId: s.id })}>
                        {t('a_addDuty')}
                      </Button>
                    </div>
                  </th>
                </tr>,
                ...rows.map((d, di) => (
                  <tr key={d.id} className="border-b border-border-strong align-top">
                    <td className="p-1">
                      <button type="button" onClick={() => setDuty({ duty: d, sectionId: s.id })} className="w-full rounded-md px-2 py-1.5 text-left font-semibold text-foreground hover:bg-action-tint">
                        {d.label}
                        {d.note && <span className="block text-xs font-normal text-muted-foreground">{d.note}</span>}
                      </button>
                    </td>
                    <td className="p-1">
                      <button type="button" onClick={() => setDuty({ duty: d, sectionId: s.id })} aria-label={`${t('a_editDuty')}: ${d.label}`} className="w-full rounded-md px-2 py-1.5 text-left font-semibold text-action tabular-nums hover:bg-action-tint">
                        <WeekTime duty={d} lang={lang} untimed={t('untimed')} />
                      </button>
                    </td>
                    {WEEKDAYS.map((wd) => {
                      const a = cellOf(roster, d.id, wd);
                      const teacher = a?.teacherId ? data.teachers.find((x) => x.id === a.teacherId) : undefined;
                      const group = a?.groupId ? data.groups.find((x) => x.id === a.groupId) : undefined;
                      return (
                        <td key={wd} className="p-1">
                          <button
                            type="button"
                            onClick={() => setCell({ duty: d, weekday: wd })}
                            aria-label={`${d.label}, ${weekdayName(wd, lang)}: ${teacher ? teacherName(teacher) : group ? groupLabel(group, lang) : t('empty')}`}
                            className={cx(
                              'flex min-h-10 w-full items-center gap-1.5 rounded-md border border-transparent px-2 py-1.5 text-left hover:border-action/40 hover:bg-action-tint',
                              !a && 'text-muted-foreground',
                              teacher && !teacher.active && 'italic',
                            )}
                          >
                            {group && <Users className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                            <span className="min-w-0">{teacher ? teacherName(teacher) : group ? groupLabel(group, lang) : '—'}</span>
                          </button>
                        </td>
                      );
                    })}
                    <td className="p-1">
                      <div className="flex justify-end gap-0.5">
                        <IconBtn label={t('a_moveUp')} disabled={di === 0} onClick={() => run({ action: 'duty.move', id: d.id, dir: -1 })}><ArrowUp className="size-4" /></IconBtn>
                        <IconBtn label={t('a_moveDown')} disabled={di === rows.length - 1} onClick={() => run({ action: 'duty.move', id: d.id, dir: 1 })}><ArrowDown className="size-4" /></IconBtn>
                      </div>
                    </td>
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>
      <Button variant="secondary" className="mt-4" icon={<Plus className="size-5" aria-hidden />} onClick={() => setSection('new')}>
        {t('a_addSection')}
      </Button>

      {cell && <CellSheet roster={roster} duty={cell.duty} weekday={cell.weekday} onClose={() => setCell(null)} />}
      {duty && <DutySheet roster={roster} duty={duty.duty} sectionId={duty.sectionId} onClose={() => setDuty(null)} />}
      {section && <SectionSheet roster={roster} section={section === 'new' ? undefined : section} onClose={() => setSection(null)} />}
    </div>
  );
}

export function IconBtn({ label, onClick, disabled, children, tone }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; tone?: 'danger' }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex size-9 items-center justify-center rounded-md transition-colors duration-150 disabled:opacity-30',
        tone === 'danger' ? 'text-destructive hover:bg-destructive-tint' : 'text-muted-foreground hover:bg-action-tint hover:text-action',
      )}
    >
      <span aria-hidden className="contents">{children}</span>
    </button>
  );
}

/** Day chips: which weekdays a change applies to. */
function DayChips({ value, onChange }: { value: Weekday[]; onChange: (v: Weekday[]) => void }) {
  const { t, lang } = useI18n();
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold text-foreground">{t('a_alsoDays')}</legend>
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAYS.map((wd) => {
          const on = value.includes(wd);
          return (
            <button
              key={wd}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== wd) : [...value, wd].sort())}
              className={cx(
                'inline-flex min-h-10 items-center gap-1 rounded-md border px-3 text-sm font-semibold transition-colors duration-150',
                on ? 'border-action bg-action text-on-primary' : 'border-border-strong bg-surface text-foreground hover:bg-action-tint',
              )}
            >
              {on && <Check className="size-4" aria-hidden />}
              {weekdayName(wd, lang, true)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function CellSheet({ roster, duty, weekday, onClose }: { roster: Roster; duty: Duty; weekday: Weekday; onClose: () => void }) {
  const { t, lang } = useI18n();
  const { data, run } = useAdmin();
  const [days, setDays] = useState<Weekday[]>([weekday]);
  const a = cellOf(roster, duty.id, weekday);
  const pick = async (teacherId: number | null, groupId: number | null) => {
    if (!days.length) return;
    if (await run({ action: 'cell.set', dutyId: duty.id, weekdays: days, teacherId, groupId }, t('saved'))) onClose();
  };
  const option = (key: string, label: string, selected: boolean, onClick: () => void, icon?: React.ReactNode) => (
    <li key={key}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        disabled={!days.length}
        className={cx(
          'flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-base transition-colors duration-150 disabled:opacity-50',
          selected ? 'bg-action-tint font-bold text-action' : 'text-foreground hover:bg-surface-page',
        )}
      >
        {icon}
        <span className="min-w-0 flex-1">{label}</span>
        {selected && <Check className="size-4 shrink-0" aria-hidden />}
      </button>
    </li>
  );
  return (
    <BottomSheet open onClose={onClose} title={t('a_cellTitle', { duty: duty.label, day: weekdayName(weekday, lang) })} size="lg">
      <DayChips value={days} onChange={setDays} />
      <ul className="mt-4 space-y-0.5">{option('empty', t('a_emptyCell'), !a, () => pick(null, null), <X className="size-4 shrink-0 text-muted-foreground" aria-hidden />)}</ul>
      <h3 className="mt-4 mb-1 text-sm font-semibold text-muted-foreground">{t('a_teachers')}</h3>
      <ul className="grid gap-0.5 sm:grid-cols-2">
        {data.teachers
          .filter((x) => x.active || x.id === a?.teacherId)
          .map((x) => option(`t${x.id}`, `${teacherName(x)}${x.active ? '' : ` (${t('a_inactive')})`}`, a?.teacherId === x.id, () => pick(x.id, null)))}
      </ul>
      <h3 className="mt-4 mb-1 text-sm font-semibold text-muted-foreground">{t('a_groups')}</h3>
      <ul className="space-y-0.5">
        {data.groups.map((g) => option(`g${g.id}`, groupLabel(g, lang), a?.groupId === g.id, () => pick(null, g.id), <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden />))}
      </ul>
    </BottomSheet>
  );
}

type WindowDraft = { weekday: '' | `${Weekday}`; start: string; end: string };

function DutySheet({ roster, duty, sectionId, onClose }: { roster: Roster; duty?: Duty; sectionId: number; onClose: () => void }) {
  const { t, lang } = useI18n();
  const { run } = useAdmin();
  const [label, setLabel] = useState(duty?.label ?? '');
  const [note, setNote] = useState(duty?.note ?? '');
  const [section, setSection] = useState(String(duty?.sectionId ?? sectionId));
  const [timing, setTiming] = useState<Timing>(duty?.timing ?? 'fixed');
  const [windows, setWindows] = useState<WindowDraft[]>(
    duty?.times.map((x) => ({ weekday: x.weekday ? (String(x.weekday) as WindowDraft['weekday']) : '', start: x.start, end: x.end })) ?? [{ weekday: '', start: '07:00', end: '07:30' }],
  );
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const bad = !label.trim() || windows.some((w) => !w.start || !w.end || w.end <= w.start);

  const save = async () => {
    setBusy(true);
    const times: DutyTime[] = windows.map((w) => ({ weekday: w.weekday ? (Number(w.weekday) as Weekday) : null, start: w.start, end: w.end }));
    const ok = await run({ action: 'duty.save', id: duty?.id, sectionId: Number(section), label, note, timing, times }, t('saved'));
    setBusy(false);
    if (ok) onClose();
  };
  const remove = async () => {
    if (!duty) return;
    if (!confirming) return setConfirming(true);
    if (await run({ action: 'duty.delete', id: duty.id }, t('saved'))) onClose();
  };
  const setW = (i: number, patch: Partial<WindowDraft>) => setWindows((ws) => ws.map((w, j) => (j === i ? { ...w, ...patch } : w)));

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={duty ? t('a_editDuty') : t('a_newDuty')}
      size="lg"
      footer={
        <div className="flex flex-wrap gap-2">
          {duty && (
            <Button variant="danger" onClick={remove} icon={<Trash2 className="size-4" aria-hidden />}>
              {confirming ? t('a_confirm') : t('a_deleteDuty')}
            </Button>
          )}
          <Button className="ml-auto" onClick={save} loading={busy} disabled={bad}>
            {t('save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {confirming && duty && <Notice tone="error">{t('a_deleteDutyConfirm', { name: duty.label })}</Notice>}
        <Field label={t('a_dutyLabel')} placeholder={t('a_dutyLabelPh')} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={200} />
        <Field label={t('a_dutyNote')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        <SelectField
          label={t('a_section')}
          value={section}
          onChange={setSection}
          options={sortedSections(roster).map((s) => ({ value: String(s.id), label: sectionName(s, lang) }))}
        />
        <div>
          <p className="mb-1.5 text-sm font-semibold text-foreground">{t('a_timing')}</p>
          <Segmented
            label={t('a_timing')}
            value={timing}
            onChange={setTiming}
            options={[
              { value: 'fixed', label: t('a_timing_fixed') },
              { value: 'approx', label: t('a_timing_approx') },
              { value: 'untimed', label: t('a_timing_untimed') },
            ]}
          />
          {timing !== 'fixed' && <p className="mt-1.5 text-sm text-muted-foreground">{t(timing === 'approx' ? 'a_timingApproxHelp' : 'a_timingUntimedHelp')}</p>}
        </div>
        <fieldset>
          <legend className="text-sm font-semibold text-foreground">{t('a_windows')}</legend>
          <p className="mb-2 text-sm text-muted-foreground">{t('a_windowsHelp')}</p>
          <ul className="space-y-2">
            {windows.map((w, i) => (
              <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-end gap-2">
                <label className="block min-w-0">
                  <span className="mb-1 block text-xs font-semibold text-muted-foreground">{t('a_appliesTo')}</span>
                  <select
                    value={w.weekday}
                    onChange={(e) => setW(i, { weekday: e.target.value as WindowDraft['weekday'] })}
                    className="h-11 w-full rounded-md border border-border-strong bg-surface px-2 text-base outline-none focus:border-action focus:ring-1 focus:ring-action"
                  >
                    <option value="">{t('everyDay')}</option>
                    {WEEKDAYS.map((wd) => (
                      <option key={wd} value={wd}>{weekdayName(wd, lang)}</option>
                    ))}
                  </select>
                </label>
                <TimeInput label={t('a_start')} value={w.start} onChange={(v) => setW(i, { start: v })} />
                <TimeInput label={t('a_end')} value={w.end} onChange={(v) => setW(i, { end: v })} invalid={!!w.end && w.end <= w.start} />
                <IconBtn label={t('a_removeWindow')} tone="danger" onClick={() => setWindows((ws) => ws.filter((_, j) => j !== i))}>
                  <X className="size-4" />
                </IconBtn>
              </li>
            ))}
          </ul>
          <Button variant="ghost" size="sm" className="mt-2" icon={<Plus className="size-4" aria-hidden />} onClick={() => setWindows((ws) => [...ws, { weekday: '', start: ws.at(-1)?.end ?? '07:00', end: ws.at(-1)?.end ?? '07:30' }])}>
            {t('a_addWindow')}
          </Button>
        </fieldset>
      </div>
    </BottomSheet>
  );
}

function TimeInput({ label, value, onChange, invalid }: { label: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        className={cx('h-11 w-[7.5rem] rounded-md border bg-surface px-2 text-base tabular-nums outline-none focus:border-action focus:ring-1 focus:ring-action', invalid ? 'border-destructive' : 'border-border-strong')}
      />
    </label>
  );
}

function SectionSheet({ roster, section, onClose }: { roster: Roster; section?: Section; onClose: () => void }) {
  const { t } = useI18n();
  const { run } = useAdmin();
  const [en, setEn] = useState(section?.nameEn ?? '');
  const [id, setId] = useState(section?.nameId ?? '');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const count = section ? dutiesOf(roster, section.id).length : 0;
  const save = async () => {
    setBusy(true);
    const ok = await run({ action: 'section.save', id: section?.id, rosterId: roster.id, nameEn: en, nameId: id }, t('saved'));
    setBusy(false);
    if (ok) onClose();
  };
  const remove = async () => {
    if (!section) return;
    if (!confirming) return setConfirming(true);
    if (await run({ action: 'section.delete', id: section.id }, t('saved'))) onClose();
  };
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={section ? t('a_editSection') : t('a_addSection')}
      footer={
        <div className="flex flex-wrap gap-2">
          {section && (
            <Button variant="danger" onClick={remove} icon={<Trash2 className="size-4" aria-hidden />}>
              {confirming ? t('a_confirm') : t('a_deleteSection')}
            </Button>
          )}
          <Button className="ml-auto" onClick={save} loading={busy} disabled={!en.trim() || !id.trim()}>
            {t('save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {confirming && section && <Notice tone="error">{t('a_deleteSectionConfirm', { name: section.nameEn, n: count })}</Notice>}
        <Field label={t('a_sectionEn')} value={en} onChange={(e) => setEn(e.target.value)} maxLength={80} />
        <Field label={t('a_sectionId')} value={id} onChange={(e) => setId(e.target.value)} maxLength={80} />
      </div>
    </BottomSheet>
  );
}
