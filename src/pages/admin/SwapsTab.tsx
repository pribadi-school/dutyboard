/**
 * Admin → Swaps: "swap for today only". Pick a date (today by default), then
 * a substitute for any duty that day. The TV shows the substitute with a
 * "Substitute for …" badge; the planned roster is unchanged.
 */
import { useMemo, useState } from 'react';
import { Repeat, Trash2 } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { TimeLabel, WhoName } from '../../components/duty';
import { Button, Card, Field, Notice, SelectField } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { dayView, plannedText, sectionName, teacherName, whoText, type DayRow } from '../../lib/roster';
import { addDays, fmtDate, isoWeekday } from '../../lib/time';
import { useAdmin } from './AdminPage';

const nextSchoolDay = (d: string) => {
  let x = d;
  while (isoWeekday(x) > 5) x = addDays(x, 1);
  return x;
};

export function SwapsTab() {
  const { t, lang } = useI18n();
  const { data, today, run } = useAdmin();
  const [date, setDate] = useState(() => nextSchoolDay(today));
  const [editing, setEditing] = useState<DayRow | null>(null);
  const day = useMemo(() => (date ? dayView(data, date, -1) : null), [data, date]);

  const upcoming = useMemo(() => {
    const duties = new Map(data.rosters.flatMap((r) => r.duties.map((d) => [d.id, d])));
    return data.overrides
      .filter((o) => o.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((o) => ({ o, duty: duties.get(o.dutyId), teacher: data.teachers.find((x) => x.id === o.teacherId) }));
  }, [data, today]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section>
        <h2 className="text-xl font-bold">{t('a_swapsTitle')}</h2>
        <p className="mt-1 text-base text-muted-foreground">{t('a_swapsLead')}</p>
        <Field className="mt-4 sm:w-64" label={t('a_date')} type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
        {!day ? (
          <div className="mt-4">
            <Notice>{t('a_noSchoolDay')}</Notice>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-base font-semibold">{fmtDate(date, lang)}</p>
            {day.sections.map(({ section, rows }) => (
              <Card key={section.id} as="section" className="overflow-hidden">
                <h3 className="border-b border-border-strong bg-surface-muted px-4 py-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">{sectionName(section, lang)}</h3>
                <ul className="divide-y divide-border-strong">
                  {rows.map((r) => (
                    <li key={r.duty.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                      <TimeLabel timing={r.duty.timing} windows={r.windows} className="w-28 shrink-0 text-sm font-semibold text-action" />
                      <div className="min-w-0 flex-1">
                        <WhoName who={r.who} className="font-bold text-foreground" />
                        <p className="text-sm text-muted-foreground">{r.duty.label}</p>
                      </div>
                      {r.who?.override ? (
                        <Button variant="secondary" size="sm" onClick={() => run({ action: 'override.delete', id: r.who!.override!.id }, t('saved'))}>
                          {t('a_swapRemove')}
                        </Button>
                      ) : (
                        <Button variant="secondary" size="sm" icon={<Repeat className="size-4" aria-hidden />} onClick={() => setEditing(r)}>
                          {t('a_swap')}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold">{t('a_upcomingSwaps')}</h2>
        {!upcoming.length ? (
          <p className="mt-2 text-base text-muted-foreground">{t('a_noSwaps')}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {upcoming.map(({ o, duty, teacher }) => (
              <li key={o.id}>
                <Card className="flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold text-foreground">{fmtDate(o.date, lang, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                    <p className="font-bold text-foreground">{teacher ? teacherName(teacher) : '—'}</p>
                    <p className="text-muted-foreground">{duty?.label}</p>
                    {o.note && <p className="mt-1 text-muted-foreground italic">{o.note}</p>}
                  </div>
                  <Button variant="ghost" size="sm" aria-label={t('a_swapRemove')} icon={<Trash2 className="size-4" aria-hidden />} onClick={() => run({ action: 'override.delete', id: o.id }, t('saved'))} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && <SwapSheet date={date} row={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SwapSheet({ date, row, onClose }: { date: string; row: DayRow; onClose: () => void }) {
  const { t, lang } = useI18n();
  const { data, run } = useAdmin();
  const [teacherId, setTeacherId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const planned = row.who ? (row.who.override ? plannedText(row.who, lang) : whoText(row.who, lang)) : '—';
  const save = async () => {
    setBusy(true);
    const ok = await run({ action: 'override.set', date, dutyId: row.duty.id, teacherId: Number(teacherId), note }, t('saved'));
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={t('a_swapTitle', { duty: row.duty.label })}
      footer={
        <Button block onClick={save} loading={busy} disabled={!teacherId}>
          {t('save')}
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-base">
          {fmtDate(date, lang)}
          <span className="block text-muted-foreground">{t('a_swapPlanned', { name: planned })}</span>
        </p>
        <SelectField
          label={t('a_swapWho')}
          value={teacherId}
          onChange={setTeacherId}
          options={[{ value: '', label: '—' }, ...data.teachers.filter((x) => x.active && x.id !== row.who?.teacher?.id).map((x) => ({ value: String(x.id), label: teacherName(x) }))]}
        />
        <Field label={t('a_swapNote')} placeholder={t('a_swapNotePh')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
      </div>
    </BottomSheet>
  );
}
