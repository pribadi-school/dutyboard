/**
 * TV display for the school lobby (public, no sign-in), 1920×1080, readable
 * from across the room. Header with logo, greeting, date, big WIB clock and a
 * QR code to the week view; "On duty now" cards; "Next up"; today's full list
 * by section (current rows highlighted, past rows dimmed).
 *
 * Weekends and after the last duty: shows the next school day, with a label.
 * Network down: keeps the last data with "Offline · last updated 07.12".
 * Phones/tablets get the normal app header and a stacked layout.
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Clock, Link2, MapPin, WifiOff } from 'lucide-react';
import QRCode from 'qrcode';
import { DutyPill, TimeLabel, WhoName, timeText } from '../components/duty';
import { Header, SchoolLogo } from '../components/Header';
import { Button, Card, Notice, Skeleton, cx } from '../components/ui';
import { useI18n, type MessageKey } from '../lib/i18n';
import { useLive, useNow } from '../lib/live';
import { dayView, sectionName, shownDay, type Day, type DayRow } from '../lib/roster';
import { fmtClock, fmtDate, fmtMin, jakarta } from '../lib/time';

const PAGE_MS = 12_000;

function greeting(min: number): MessageKey {
  return min < 11 * 60 ? 'greet_morning' : min < 15 * 60 ? 'greet_midday' : min < 18 * 60 ? 'greet_afternoon' : 'greet_night';
}

/**
 * Card grid for n cards on the TV: one row of up to 6 (prayer time has 6 at
 * once), then 6 × 2; beyond 12 the cards page.
 */
function tvGrid(n: number) {
  return n <= 6 ? { cols: Math.max(n, 1), rows: 1 } : { cols: 6, rows: 2 };
}

function useIsTv() {
  const [tv, setTv] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    const fit = () => setTv(window.innerWidth >= 1024);
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return tv;
}

/** Split sections into `n` columns in order, balancing by line count (TV list). */
function columns(day: Day, n: number) {
  const weight = (s: Day['sections'][number]) => 1 + s.rows.length * 2;
  const total = day.sections.reduce((a, s) => a + weight(s), 0);
  const out: Day['sections'][] = Array.from({ length: n }, () => []);
  let col = 0;
  let acc = 0;
  for (const s of day.sections) {
    if (col < n - 1 && acc > 0 && acc + weight(s) > (total / n) * (col + 1) + 1) col++;
    out[col].push(s);
    acc += weight(s);
  }
  return out.filter((c) => c.length);
}

export default function TvPage() {
  const { t, lang } = useI18n();
  const { data, offline, updatedAt, failed, refresh } = useLive();
  const { now, simulated } = useNow(1_000);
  const tv = useIsTv();
  const { date: today, minutes, seconds } = jakarta(now);
  const minuteKey = `${today} ${minutes}`;

  const shown = useMemo(() => (data ? shownDay(data, today, minutes) : null), [data, today, minutes]);
  const isToday = shown?.reason === 'today';
  // Recomputed once a minute (and on every data change), not every second.
  const day = useMemo(() => (data && shown ? dayView(data, shown.date, isToday ? minutes : -1) : null), [data, shown, isToday, minuteKey]); // minutes is inside minuteKey // eslint-disable-line react-hooks/exhaustive-deps

  const current = useMemo(() => day?.rows.filter((r) => r.state === 'now' && r.who) ?? [], [day]);
  const next = useMemo(() => day?.rows.filter((r) => r.state === 'next') ?? [], [day]);
  const nextStart = next[0]?.upcoming?.start;

  // TV: page through the cards when they don't all fit.
  const grid = tvGrid(current.length);
  const perPage = tv ? grid.cols * grid.rows : 999;
  const pages = Math.max(1, Math.ceil(current.length / perPage));
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (pages <= 1) return setPage(0);
    const id = setInterval(() => setPage((p) => (p + 1) % pages), PAGE_MS);
    return () => clearInterval(id);
  }, [pages]);
  const shownCards = current.slice((page % pages) * perPage, ((page % pages) + 1) * perPage);

  // QR code to the week view on this same site (teachers open "my duties" on their phone).
  const weekUrl = `${window.location.origin}/week`;
  const [qr, setQr] = useState('');
  useEffect(() => {
    QRCode.toString(weekUrl, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#12233c', light: '#ffffff' } }).then(setQr);
  }, [weekUrl]);

  const secondsNow = minutes * 60 + seconds;
  const left = (r: DayRow) => Math.max(1, Math.ceil((r.current!.end * 60 - secondsNow) / 60));
  const until = (start: number) => {
    const m = Math.max(1, Math.ceil((start * 60 - secondsNow) / 60));
    return m < 60 ? t('inMin', { n: m }) : t('inHours', { h: Math.floor(m / 60), m: m % 60 });
  };
  const dayName = shown ? fmtDate(shown.date, lang, { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  const banner = shown?.reason === 'weekend' ? t('tv_weekend') : shown?.reason === 'afterHours' ? t('tv_afterHours', { day: dayName }) : null;

  return (
    <div className={cx('flex flex-col bg-surface-page', tv ? 'h-dvh overflow-hidden' : 'min-h-dvh')}>
      {!tv && <Header title={t('nav_tv')} />}
      <main className={cx('flex min-h-0 w-full flex-1 flex-col', tv ? 'gap-[1.8vh] px-[2vw] py-[2vh]' : 'gap-5 px-4 pt-6 pb-10')}>
        {/* ---------- Header: logo, greeting, QR, clock ---------- */}
        <header className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-[2vw] sm:gap-y-3">
          <div className={cx('flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-[1.5vw]', tv && 'min-w-0 flex-1')}>
            {tv && <SchoolLogo className="h-[clamp(36px,6vh,84px)]" />}
            <div>
              <p className="text-[clamp(13px,1.8vh,24px)] font-bold tracking-wide text-action uppercase">{t('tv_lead')}</p>
              <h1 className="text-[clamp(24px,4.2vh,56px)] leading-tight font-extrabold">{t(greeting(minutes))}</h1>
            </div>
          </div>
          {tv && (
            <div className="hidden shrink-0 items-center gap-[1vw] xl:flex">
              {qr && (
                <div
                  className="aspect-square h-[clamp(72px,10vh,140px)] shrink-0 rounded-md bg-surface p-[0.5vh] [&_svg]:size-full"
                  role="img"
                  aria-label={`QR: ${weekUrl}`}
                  dangerouslySetInnerHTML={{ __html: qr }}
                />
              )}
              <div>
                <p className="text-[clamp(13px,1.7vh,22px)] leading-tight text-muted-foreground">{t('tv_scan')}</p>
                <p className="mt-[0.5vh] flex items-center gap-[0.3em] text-[clamp(13px,1.9vh,26px)] leading-none font-bold text-action">
                  <Link2 className="size-[1em] shrink-0" aria-hidden />
                  {window.location.host}/week
                </p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 border-t border-border-strong pt-4 sm:ml-auto sm:block sm:border-0 sm:pt-0 sm:text-right">
            <p className="flex shrink-0 items-center justify-end gap-2 text-[34px] leading-none font-extrabold tabular-nums sm:gap-3 sm:text-[clamp(28px,5.5vh,76px)]">
              <Clock className="size-[0.8em] text-action" aria-hidden />
              {fmtClock(now)}
            </p>
            <div className="contents sm:block">
              <p className="col-span-2 row-start-2 flex items-center gap-2 text-[clamp(13px,1.9vh,26px)] text-muted-foreground sm:mt-[1vh] sm:justify-end">
                <CalendarDays className="size-[1em] shrink-0" aria-hidden />
                {fmtDate(today, lang)}
                {simulated && ' · simulated'}
              </p>
              <p className="col-start-2 row-start-1 text-right text-[clamp(14px,2vh,26px)] font-semibold sm:mt-[0.6vh]" aria-live="polite">
                {offline ? (
                  <span className="inline-flex items-center gap-[0.35em] rounded-sm bg-accent-tint px-[0.5em] py-[0.15em] text-foreground ring-1 ring-accent/30">
                    <WifiOff className="size-[1em] text-accent" aria-hidden />
                    {updatedAt ? t('offlineSince', { time: fmtClock(updatedAt) }) : t('offline')}
                  </span>
                ) : (
                  current.length > 0 && (
                    <>
                      {t('tv_onDutyCount', { n: current.length })}
                      {pages > 1 && <span className="text-muted-foreground tabular-nums"> · {t('tv_page', { p: (page % pages) + 1, n: pages })}</span>}
                    </>
                  )
                )}
              </p>
            </div>
          </div>
        </header>

        {!day ? (
          failed ? (
            <Notice tone="error" action={<Button size="sm" variant="secondary" onClick={refresh}>{t('retry')}</Button>}>
              {t('loadFailed')}
            </Notice>
          ) : (
            <div className={cx('grid gap-[1.2vw]', tv ? 'min-h-0 flex-1 grid-cols-4' : 'grid-cols-1')}>
              {Array.from({ length: tv ? 4 : 3 }, (_, i) => (
                <Skeleton key={i} className="min-h-40 rounded-lg" />
              ))}
            </div>
          )
        ) : (
          <>
            {banner && (
              <p className="flex items-center gap-[0.5em] rounded-md border border-action/20 bg-action-tint px-[1em] py-[0.6em] text-[clamp(15px,2.2vh,30px)] font-bold text-foreground" role="status">
                <CalendarDays className="size-[1em] shrink-0 text-action" aria-hidden />
                {banner}
              </p>
            )}

            {/* ---------- On duty now + Next up ---------- */}
            <section className={cx(tv ? 'grid min-h-0 flex-[0.8] grid-cols-[minmax(0,1fr)_minmax(0,22vw)] gap-[1.2vw]' : 'flex flex-col gap-5')} aria-label={t('tv_onDuty')}>
              {current.length ? (
                <ul
                  className={cx('grid', tv ? 'min-h-0 gap-[1.2vw]' : 'gap-4')}
                  style={
                    tv
                      ? { gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))` }
                      : { gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }
                  }
                >
                  {shownCards.map((r) => (
                    // TV: each card is a size container; text is sized from the card (cqh/cqw) so it always fits.
                    <li key={r.duty.id} className="min-h-0" style={tv ? { containerType: 'size' } : undefined}>
                      <Card className={cx('flex h-full flex-col overflow-hidden border-gradient-end/50', tv ? 'px-[min(6cqh,6cqw)] py-[5cqh]' : 'p-5')}>
                        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                          <TimeLabel
                            timing={r.duty.timing}
                            windows={[r.current!]}
                            className={cx('leading-tight font-bold whitespace-nowrap text-action', tv ? 'text-[min(8cqh,9cqw)]' : 'text-lg')}
                          />
                          <DutyPill state="now" className={tv ? 'text-[min(5.5cqh,6.5cqw)]' : 'text-xs'} />
                        </div>
                        <p className={cx('truncate font-semibold tracking-wide text-muted-foreground uppercase', tv ? 'mt-[3cqh] text-[min(5.5cqh,6cqw)]' : 'mt-2 text-xs')}>
                          {sectionName(r.section, lang)}
                        </p>
                        <WhoName
                          who={r.who}
                          wrap
                          className={cx('leading-[1.15] font-extrabold text-foreground', tv ? 'mt-[1cqh] text-[min(12cqh,12.5cqw)]' : 'mt-1 text-2xl')}
                          subClassName={tv ? 'text-[min(5.5cqh,6cqw)]' : 'text-xs'}
                        />
                        <p className={cx('flex min-w-0 items-start gap-[0.3em] leading-snug font-semibold text-foreground', tv ? 'mt-[3cqh] text-[min(7cqh,8cqw)]' : 'mt-2 text-base')}>
                          <MapPin className="mt-[0.15em] size-[0.95em] shrink-0 text-action" aria-hidden />
                          <span className={tv ? 'line-clamp-3' : undefined}>{r.duty.label}</span>
                        </p>
                        <p className={cx('flex items-center gap-[0.35em] border-t border-border-strong text-muted-foreground', tv ? 'mt-auto pt-[3cqh] text-[min(6cqh,7cqw)]' : 'mt-4 pt-3 text-sm')}>
                          <Clock className="size-[1em] shrink-0" aria-hidden />
                          {isToday ? t('minLeft', { n: left(r) }) : null}
                        </p>
                      </Card>
                    </li>
                  ))}
                </ul>
              ) : (
                <Card className={cx('flex items-center justify-center text-center', tv ? 'min-h-0 p-[4vh]' : 'p-6')}>
                  <div>
                    <p className="text-[clamp(22px,4vh,52px)] font-bold">{isToday ? t('tv_noneNow') : fmtDate(shown!.date, lang)}</p>
                    <p className="mt-2 text-[clamp(16px,2.6vh,34px)] text-muted-foreground">
                      {nextStart !== undefined ? t('tv_nextStarts', { time: fmtMin(nextStart) }) : t('tv_noMore')}
                    </p>
                  </div>
                </Card>
              )}

              {/* Next up */}
              <Card className={cx('flex min-h-0 flex-col overflow-hidden', tv ? 'p-[2.2vh]' : 'p-5')}>
                <h2 className="flex items-center gap-[0.4em] text-[clamp(16px,2.4vh,32px)] font-bold">
                  <ArrowRight className="size-[1em] text-action" aria-hidden />
                  {t('tv_nextUp')}
                </h2>
                {next.length && nextStart !== undefined ? (
                  <>
                    <p className="mt-[1vh] text-[clamp(28px,5.5vh,72px)] leading-none font-extrabold text-action tabular-nums">
                      {next[0].duty.timing === 'approx' && '± '}
                      {fmtMin(nextStart)}
                    </p>
                    {isToday && <p className="mt-[0.6vh] text-[clamp(14px,2vh,26px)] font-semibold text-muted-foreground">{until(nextStart)}</p>}
                    <ul className="mt-[1.6vh] min-h-0 space-y-[1.2vh] overflow-hidden border-t border-border-strong pt-[1.4vh]">
                      {next.slice(0, 3).map((r) => (
                        <li key={r.duty.id} className="min-w-0">
                          <WhoName who={r.who} className="text-[clamp(16px,2.5vh,32px)] leading-tight font-bold text-foreground" subClassName="text-[clamp(11px,1.5vh,20px)]" />
                          <p className="truncate text-[clamp(13px,1.8vh,24px)] text-muted-foreground">{r.duty.label}</p>
                        </li>
                      ))}
                      {next.length > 3 && <li className="text-[clamp(13px,1.8vh,24px)] font-semibold text-muted-foreground">+{next.length - 3}</li>}
                    </ul>
                  </>
                ) : (
                  <p className="mt-[1vh] text-[clamp(16px,2.4vh,32px)] text-muted-foreground">{t('tv_noMore')}</p>
                )}
              </Card>
            </section>

            {/* ---------- The day's full list ---------- */}
            <section className={cx(tv ? 'flex min-h-0 flex-[1.45] flex-col' : '')} aria-labelledby="day-list">
              <h2 id="day-list" className={cx('font-bold', tv ? 'mb-[1vh] text-[clamp(16px,2.3vh,30px)]' : 'mb-3 text-xl')}>
                {isToday ? t('tv_todayList') : t('tv_dayList', { day: dayName })}
              </h2>
              <div className={cx(tv ? 'grid min-h-0 flex-1 grid-cols-3 gap-[1.2vw]' : 'space-y-4')}>
                {columns(day, tv ? 3 : 1).map((col, i) => (
                  <div key={i} className={cx(tv ? 'min-h-0 space-y-[1.2vh] overflow-hidden' : 'space-y-4')}>
                    {col.map(({ section, rows }) => (
                      <Card key={section.id} as="section" className="overflow-hidden">
                        <h3 className={cx('border-b border-border-strong bg-surface-muted font-bold tracking-wide text-muted-foreground uppercase', tv ? 'px-[0.9vw] py-[0.5vh] text-[clamp(11px,1.5vh,20px)]' : 'px-4 py-2 text-xs')}>
                          {sectionName(section, lang)}
                        </h3>
                        <ul className="divide-y divide-border-strong">
                          {rows.map((r) => (
                            <ListRow key={r.duty.id} row={r} tv={tv} />
                          ))}
                        </ul>
                      </Card>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function ListRow({ row: r, tv }: { row: DayRow; tv: boolean }) {
  const { t } = useI18n();
  return (
    <li
      className={cx(
        'grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-[0.8em]',
        tv ? 'px-[0.9vw] py-[0.6vh] text-[clamp(13px,1.85vh,26px)]' : 'px-4 py-2.5 text-base',
        r.state === 'now' && 'bg-status-progress-bg',
        r.state === 'past' && 'text-muted-foreground',
      )}
      aria-current={r.state === 'now' ? 'true' : undefined}
    >
      <span className={cx('pt-[0.05em] font-semibold whitespace-nowrap tabular-nums', r.state === 'past' ? 'text-muted-foreground' : 'text-action', tv ? 'w-[6.6em]' : 'w-[6.4em]')}>
        {/* One line per window (break time has two). */}
        {r.duty.timing === 'untimed' || !r.windows.length ? (
          <span className="whitespace-normal">{t('untimed')}</span>
        ) : (
          r.windows.map((w) => (
            <span key={w.start} className={cx('block', r.current && r.current !== w && 'opacity-60')}>
              {timeText(r.duty.timing, [w], '')}
            </span>
          ))
        )}
      </span>
      <span className="min-w-0">
        <WhoName who={r.who} className={cx('leading-tight font-bold', r.state === 'past' ? 'text-muted-foreground' : 'text-foreground')} subClassName="text-[0.75em]" />
        <span className="block truncate text-[0.85em] leading-snug text-muted-foreground">{r.duty.label}</span>
      </span>
      <DutyPill state={r.state} className="text-[0.75em]" />
    </li>
  );
}
