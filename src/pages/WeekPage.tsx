/**
 * /week — the whole week, for teachers' phones. Pick your name under "My
 * duties" (remembered on this device) to highlight your cells, including
 * groups that cover you ("All teachers", "All male teachers").
 * Tablet/desktop: a grid like the printed PDF. Phones: one day at a time.
 */
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { WhoName } from '../components/duty';
import { Header } from '../components/Header';
import { Button, Card, Notice, SelectField, Skeleton, Switch, cx } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { useLive, useNow } from '../lib/live';
import { dutiesOf, includes, rosterFor, sectionName, sortedSections, teacherName, timeGroups, weekCells, whoOn, windowsFor, type Window } from '../lib/roster';
import { KEYS, load, save } from '../lib/storage';
import { addDays, fmtDate, fmtMin, isoWeekday, jakarta, mondayOf, weekdayName } from '../lib/time';
import { WEEKDAYS, type BoardData, type Duty, type Lang, type Roster, type Teacher, type Weekday } from '../lib/types';

export function windowsText(duty: Duty, windows: Window[], untimed: string) {
  if (duty.timing === 'untimed' || !windows.length) return [untimed];
  return windows.map((w) => `${duty.timing === 'approx' ? '± ' : ''}${fmtMin(w.start)}–${fmtMin(w.end)}`);
}

/** The time cell of a week row: one block, or one per group of days when the times differ. */
export function WeekTime({ duty, lang, untimed }: { duty: Duty; lang: Lang; untimed: string }) {
  const groups = timeGroups(duty);
  if (groups.length === 1) return <>{windowsText(duty, groups[0].windows, untimed).map((l) => <span key={l} className="block">{l}</span>)}</>;
  return (
    <>
      {groups.map((g) => (
        <span key={g.weekdays.join()} className="block [&+&]:mt-1">
          <span className="block text-xs font-semibold text-muted-foreground">{g.weekdays.map((d) => weekdayName(d, lang, true)).join(', ')}</span>
          {windowsText(duty, g.windows, untimed).map((l) => <span key={l} className="block">{l}</span>)}
        </span>
      ))}
    </>
  );
}

export default function WeekPage() {
  const { t, lang } = useI18n();
  const { data, failed, refresh } = useLive();
  const { now } = useNow(30_000);
  const today = jakarta(now).date;
  const [offset, setOffset] = useState(0);
  const monday = addDays(mondayOf(today), offset * 7);
  const dates = WEEKDAYS.map((wd) => addDays(monday, wd - 1));
  const inWeek = dates.includes(today);
  const roster = data ? rosterFor(data.rosters, inWeek ? today : monday) : undefined;

  const [meId, setMeId] = useState<number | null>(() => load<number | null>(KEYS.me, null));
  const me = data?.teachers.find((x) => x.id === meId);
  const pickMe = (v: string) => {
    const id = v ? Number(v) : null;
    setMeId(id);
    save(KEYS.me, id);
  };
  const [onlyMine, setOnlyMine] = useState(false);
  const [tab, setTab] = useState<Weekday>(() => {
    const wd = isoWeekday(today);
    return (wd <= 5 ? wd : 1) as Weekday;
  });

  const range = `${fmtDate(dates[0], lang, { day: 'numeric', month: 'short' })} – ${fmtDate(dates[4], lang, { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <div className="min-h-dvh">
      <Header title={t('week_title')} wide />
      <main className="mx-auto max-w-[1400px] px-4 pt-6 pb-16 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[28px] leading-tight font-bold">{t('week_title')}</h1>
            <p className="mt-1 text-base text-muted-foreground">{t('week_lead')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOffset((o) => o - 1)} aria-label={t('week_prev')} icon={<ChevronLeft className="size-5" aria-hidden />} />
            <p className="min-w-0 flex-1 text-center text-base font-semibold tabular-nums sm:min-w-56">{range}</p>
            <Button variant="secondary" size="sm" onClick={() => setOffset((o) => o + 1)} aria-label={t('week_next')} icon={<ChevronRight className="size-5" aria-hidden />} />
            {offset !== 0 && (
              <Button variant="ghost" size="sm" onClick={() => setOffset(0)}>
                {t('week_this')}
              </Button>
            )}
          </div>
        </div>

        {!data || !roster ? (
          failed ? (
            <div className="mt-6">
              <Notice tone="error" action={<Button size="sm" variant="secondary" onClick={refresh}>{t('retry')}</Button>}>
                {t('loadFailed')}
              </Notice>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              <Skeleton className="h-12 w-72" />
              <Skeleton className="h-96 w-full rounded-lg" />
            </div>
          )
        ) : (
          <>
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end">
              <SelectField
                className="sm:w-80"
                label={t('week_me')}
                value={meId ? String(meId) : ''}
                onChange={pickMe}
                options={[
                  { value: '', label: t('week_everyone') },
                  ...data.teachers.filter((x) => x.active || x.id === meId).map((x) => ({ value: String(x.id), label: teacherName(x) })),
                ]}
              />
              {me && (
                <label className="flex min-h-12 items-center gap-3 text-base font-semibold md:hidden">
                  <Switch checked={onlyMine} onChange={setOnlyMine} label={t('week_onlyMine')} />
                  <span aria-hidden>{t('week_onlyMine')}</span>
                </label>
              )}
              <p className="text-sm text-muted-foreground sm:ml-auto">{t('week_version', { date: fmtDate(roster.releasedOn, lang, { day: 'numeric', month: 'long', year: 'numeric' }) })}</p>
            </div>

            {me && <MySummary data={data} roster={roster} me={me} dates={dates} />}

            <WeekGrid data={data} roster={roster} me={me} dates={dates} today={today} />
            <DayList data={data} roster={roster} me={me} dates={dates} today={today} tab={tab} setTab={setTab} onlyMine={onlyMine && !!me} />
          </>
        )}
      </main>
    </div>
  );
}

type GridProps = { data: BoardData; roster: Roster; me: Teacher | undefined; dates: string[]; today: string };

/** "Your duties this week": every cell that includes me, day by day. */
function MySummary({ data, roster, me, dates }: Omit<GridProps, 'today'> & { me: Teacher }) {
  const { t, lang } = useI18n();
  const days = WEEKDAYS.map((wd) => ({
    wd,
    items: sortedSections(roster).flatMap((s) =>
      dutiesOf(roster, s.id)
        .map((d) => ({ d, who: whoOn(data, roster, d.id, wd, dates[wd - 1]) }))
        .filter(({ who }) => includes(who, me)),
    ),
  })).filter((x) => x.items.length);
  return (
    <Card as="section" className="mt-6 p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Star className="size-5 text-action" aria-hidden />
        {t('week_mine')}
      </h2>
      {!days.length ? (
        <p className="mt-2 text-base text-muted-foreground">{t('week_mineNone', { name: teacherName(me) })}</p>
      ) : (
        <ul className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
          {days.map(({ wd, items }) => (
            <li key={wd}>
              <p className="text-sm font-bold text-foreground">{fmtDate(dates[wd - 1], lang, { weekday: 'long', day: 'numeric', month: 'short' })}</p>
              <ul className="mt-1.5 space-y-2">
                {items.map(({ d, who }) => (
                  <li key={d.id} className="text-sm leading-snug">
                    <span className="block font-semibold text-action tabular-nums">{windowsText(d, windowsFor(d, wd), t('untimed')).join(' · ')}</span>
                    <span className="block text-foreground">{d.label}</span>
                    {who?.group && <span className="block text-muted-foreground">{t('week_includesGroup', { group: lang === 'id' ? who.group.labelId : who.group.labelEn })}</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Tablet/desktop: the PDF-style grid. */
function WeekGrid({ data, roster, me, dates, today }: GridProps) {
  const { t, lang } = useI18n();
  return (
    <div className="mt-6 hidden overflow-x-auto rounded-lg border border-border-strong bg-surface md:block">
      <table className="w-full min-w-[900px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border-strong bg-surface-muted">
            <th scope="col" className="w-36 px-3 py-3 font-semibold text-muted-foreground">{t('week_time')}</th>
            {WEEKDAYS.map((wd) => {
              const isToday = dates[wd - 1] === today;
              return (
                <th key={wd} scope="col" className={cx('px-3 py-3 font-semibold', isToday ? 'bg-action-tint text-action' : 'text-foreground')} aria-current={isToday ? 'date' : undefined}>
                  <span className="block">{weekdayName(wd, lang)}</span>
                  <span className="block text-xs font-medium text-muted-foreground">
                    {fmtDate(dates[wd - 1], lang, { day: 'numeric', month: 'short' })}
                    {isToday && ` · ${t('today')}`}
                  </span>
                </th>
              );
            })}
            <th scope="col" className="w-64 px-3 py-3 font-semibold text-muted-foreground">{t('week_duty')}</th>
          </tr>
        </thead>
        <tbody>
          {sortedSections(roster).map((s) => (
            <SectionRows key={s.id} data={data} roster={roster} sectionId={s.id} name={sectionName(s, lang)} me={me} dates={dates} today={today} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionRows({ data, roster, sectionId, name, me, dates, today }: GridProps & { sectionId: number; name: string }) {
  const { t, lang } = useI18n();
  return (
    <>
      <tr className="border-b border-border-strong bg-surface-page">
        <th colSpan={7} scope="colgroup" className="px-3 py-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
          {name}
        </th>
      </tr>
      {dutiesOf(roster, sectionId).map((d) => (
        <tr key={d.id} className="border-b border-border-strong align-top last:border-b-0">
          <td className="px-3 py-2.5 font-semibold text-action tabular-nums">
            <WeekTime duty={d} lang={lang} untimed={t('untimed')} />
          </td>
          {weekCells(data, roster, d.id, (wd) => dates[wd - 1]).map((c) => {
            const mine = includes(c.who, me);
            const isToday = c.weekdays.some((wd) => dates[wd - 1] === today);
            return (
              <td
                key={c.weekdays[0]}
                colSpan={c.weekdays.length}
                className={cx('px-3 py-2.5', mine ? 'bg-action-tint font-bold text-action' : isToday ? 'bg-surface-page' : '', c.weekdays.length > 1 && 'text-center')}
              >
                <span className="inline-flex items-start gap-1.5">
                  {mine && <Star className="mt-0.5 size-3.5 shrink-0 fill-current" aria-label={t('week_me')} />}
                  <WhoName who={c.who} className={mine ? 'text-action' : 'text-foreground'} />
                </span>
              </td>
            );
          })}
          <td className="px-3 py-2.5 text-foreground">
            {d.label}
            {d.note && <span className="block text-xs text-muted-foreground">{d.note}</span>}
          </td>
        </tr>
      ))}
    </>
  );
}

/** Phones: one day at a time, with day tabs. */
function DayList({ data, roster, me, dates, today, tab, setTab, onlyMine }: GridProps & { tab: Weekday; setTab: (wd: Weekday) => void; onlyMine: boolean }) {
  const { t, lang } = useI18n();
  const date = dates[tab - 1];
  const sections = useMemo(
    () =>
      sortedSections(roster)
        .map((s) => ({
          s,
          rows: dutiesOf(roster, s.id)
            .map((d) => ({ d, who: whoOn(data, roster, d.id, tab, date), windows: windowsFor(d, tab) }))
            .filter((r) => !onlyMine || includes(r.who, me)),
        }))
        .filter((x) => x.rows.length),
    [data, roster, tab, date, onlyMine, me],
  );
  return (
    <div className="mt-6 md:hidden">
      <div role="tablist" aria-label={t('week_day')} className="grid grid-cols-5 gap-1 rounded-md border border-border-strong bg-surface-muted p-0.5">
        {WEEKDAYS.map((wd) => {
          const isToday = dates[wd - 1] === today;
          return (
            <button
              key={wd}
              type="button"
              role="tab"
              aria-selected={tab === wd}
              onClick={() => setTab(wd)}
              className={cx(
                'flex min-h-14 flex-col items-center justify-center rounded-sm px-1 text-sm font-semibold transition-[background-color,color] duration-150',
                tab === wd ? 'bg-surface text-foreground ring-1 ring-border-strong' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span>{weekdayName(wd, lang, true)}</span>
              <span className={cx('text-xs font-medium tabular-nums', isToday && 'text-action')}>{isToday ? t('today') : fmtDate(dates[wd - 1], lang, { day: 'numeric' })}</span>
            </button>
          );
        })}
      </div>
      <h2 className="mt-5 text-lg font-bold">{fmtDate(date, lang)}</h2>
      {!sections.length ? (
        <p className="mt-3 text-base text-muted-foreground">{onlyMine && me ? t('week_mineNone', { name: teacherName(me) }) : t('week_noDuties')}</p>
      ) : (
        <div className="mt-3 space-y-4">
          {sections.map(({ s, rows }) => (
            <Card key={s.id} as="section" className="overflow-hidden">
              <h3 className="border-b border-border-strong bg-surface-muted px-4 py-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">{sectionName(s, lang)}</h3>
              <ul className="divide-y divide-border-strong">
                {rows.map(({ d, who, windows }) => {
                  const mine = includes(who, me);
                  return (
                    <li key={d.id} className={cx('grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 px-4 py-3 text-base', mine && 'bg-action-tint')}>
                      <span className="min-w-[6.6em] font-semibold whitespace-nowrap text-action tabular-nums">
                        {windowsText(d, windows, t('untimed')).map((l) => (
                          <span key={l} className="block">{l}</span>
                        ))}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-start gap-1.5">
                          {mine && <Star className="mt-1 size-3.5 shrink-0 fill-current text-action" aria-label={t('week_me')} />}
                          <WhoName who={who} className="leading-snug font-bold text-foreground" />
                        </span>
                        <span className="block text-sm leading-snug text-muted-foreground">{d.label}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
