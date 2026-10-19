/**
 * /print — the week laid out like the printed PDF, for the notice board:
 * school name, title, academic year; Time | Mon–Fri | Note; rows that share a
 * time (break, prayer, afternoon) share one time cell; groups span days.
 * ?roster=<id> prints another version (default: the one in use today).
 */
import { useSearchParams } from 'react-router';
import { Printer } from 'lucide-react';
import { Header, SchoolLogo } from '../components/Header';
import { Button, SelectField, Skeleton } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { useLive, useNow } from '../lib/live';
import { dutiesOf, rosterFor, sectionName, sortedSections, weekCells, whoText } from '../lib/roster';
import { fmtDate, jakarta, weekdayName } from '../lib/time';
import { WEEKDAYS, type BoardData, type Duty, type Roster } from '../lib/types';
import { WeekTime } from './WeekPage';

/** Rows of one section, grouped where neighbours share exactly the same times. */
function timeBlocks(duties: Duty[]) {
  const key = (d: Duty) => JSON.stringify([d.timing, d.times]);
  const out: Duty[][] = [];
  for (const d of duties) {
    const last = out[out.length - 1];
    if (last && key(last[0]) === key(d)) last.push(d);
    else out.push([d]);
  }
  return out;
}

export default function PrintPage() {
  const { t, lang } = useI18n();
  const { data } = useLive();
  const { now } = useNow(60_000);
  const [params, setParams] = useSearchParams();
  const today = jakarta(now).date;
  const chosen = Number(params.get('roster'));
  const roster = data ? (data.rosters.find((r) => r.id === chosen) ?? rosterFor(data.rosters, today)) : undefined;

  return (
    <div className="min-h-dvh print:bg-white">
      <Header title={t('nav_print')} wide />
      <main className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6 print:max-w-none print:p-0">
        <div className="no-print mb-6 flex flex-col gap-4 sm:flex-row sm:items-end">
          {data && roster && (
            <SelectField
              className="sm:w-96"
              label={t('print_version')}
              value={String(roster.id)}
              onChange={(v) => setParams({ roster: v })}
              options={[...data.rosters]
                .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
                .map((r) => ({ value: String(r.id), label: `${r.title} · ${fmtDate(r.effectiveFrom, lang, { day: 'numeric', month: 'short', year: 'numeric' })}` }))}
            />
          )}
          <Button onClick={() => window.print()} icon={<Printer className="size-5" aria-hidden />}>
            {t('print_button')}
          </Button>
          <p className="text-sm text-muted-foreground sm:ml-auto sm:max-w-80">{t('print_hint')}</p>
        </div>
        {!data || !roster ? <Skeleton className="h-[600px] w-full rounded-lg" /> : <PrintSheet data={data} roster={roster} />}
      </main>
    </div>
  );
}

function PrintSheet({ data, roster }: { data: BoardData; roster: Roster }) {
  const { t, lang } = useI18n();
  const date = (d: string) => fmtDate(d, lang, { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <article className="print-sheet overflow-x-auto rounded-lg border border-border-strong bg-surface p-6 print:overflow-visible print:rounded-none print:border-0 print:p-0">
      <header className="mb-4 flex items-center gap-5 border-b-2 border-foreground pb-3">
        <SchoolLogo className="h-12" />
        <div className="flex-1 text-center">
          <p className="text-lg font-extrabold tracking-wide text-foreground uppercase">{t('schoolFull')}</p>
          <p className="text-base font-bold tracking-wide text-foreground uppercase">{t('print_title')}</p>
          <p className="text-sm font-semibold text-foreground uppercase">{t('print_year', { title: roster.title })}</p>
        </div>
        <div className="w-[120px] text-right text-xs text-muted-foreground">
          <p>{t('print_released', { date: date(roster.releasedOn) })}</p>
        </div>
      </header>
      <table className="w-full min-w-[900px] border-collapse text-[12px] leading-snug text-foreground print:min-w-0 print:text-[10.5px]">
        <thead>
          <tr className="bg-surface-muted">
            <th className="w-[13%] border border-foreground/40 px-2 py-1.5 text-center font-bold">{t('week_time')}</th>
            {WEEKDAYS.map((wd) => (
              <th key={wd} className="w-[12%] border border-foreground/40 px-2 py-1.5 text-center font-bold uppercase">
                {weekdayName(wd, lang)}
              </th>
            ))}
            <th className="border border-foreground/40 px-2 py-1.5 text-center font-bold">{t('week_duty')}</th>
          </tr>
        </thead>
        <tbody>
          {sortedSections(roster).map((s) =>
            timeBlocks(dutiesOf(roster, s.id)).map((block, bi) =>
              block.map((d, di) => (
                <tr key={d.id} className="break-inside-avoid align-middle">
                  {di === 0 && (
                    <td rowSpan={block.length} className="border border-foreground/40 bg-surface-page px-2 py-1.5 text-center font-semibold tabular-nums">
                      {bi === 0 && <span className="block text-[0.85em] font-bold tracking-wide text-muted-foreground uppercase">{sectionName(s, lang)}</span>}
                      <WeekTime duty={d} lang={lang} untimed={t('untimed')} />
                    </td>
                  )}
                  {weekCells(data, roster, d.id).map((c) => (
                    <td key={c.weekdays[0]} colSpan={c.weekdays.length} className="border border-foreground/40 px-2 py-1.5 text-center">
                      {whoText(c.who, lang)}
                    </td>
                  ))}
                  <td className="border border-foreground/40 px-2 py-1.5">
                    {d.label}
                    {d.note && <span className="block text-[0.9em] text-muted-foreground">{d.note}</span>}
                  </td>
                </tr>
              )),
            ),
          )}
        </tbody>
      </table>
      <p className="mt-3 text-right text-xs text-muted-foreground">{t('print_effective', { date: date(roster.effectiveFrom) })}</p>
    </article>
  );
}
