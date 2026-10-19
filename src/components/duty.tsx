/**
 * Small pieces every roster screen shares: a duty's time label, its status
 * pill (colour + icon + text, never colour alone) and who is on it (with the
 * "substitute" badge for a one-day swap).
 */
import { ArrowRight, Check, Repeat, Users } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { plannedText, whoText, type RowState, type Who, type Window } from '../lib/roster';
import { fmtMin } from '../lib/time';
import type { Timing } from '../lib/types';
import { PulseDot, cx } from './ui';

export function timeText(timing: Timing, windows: Window[], untimed: string) {
  if (timing === 'untimed' || !windows.length) return untimed;
  const span = windows.map((w) => `${fmtMin(w.start)}–${fmtMin(w.end)}`).join(' · ');
  return timing === 'approx' ? `± ${span}` : span;
}

export function TimeLabel({ timing, windows, className }: { timing: Timing; windows: Window[]; className?: string }) {
  const { t } = useI18n();
  return (
    <span className={cx('tabular-nums', className)} title={timing === 'approx' ? t('approxHelp') : undefined}>
      {timeText(timing, windows, t('untimed'))}
    </span>
  );
}

export function DutyPill({ state, className }: { state: RowState; className?: string }) {
  const { t } = useI18n();
  if (state === 'later' || state === 'untimed') return null;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-[0.4em] rounded-sm px-[0.5em] py-[0.2em] font-semibold whitespace-nowrap',
        state === 'now' && 'bg-status-progress-bg text-status-progress-fg ring-1 ring-gradient-end/40',
        state === 'next' && 'bg-action-tint text-action ring-1 ring-action/25',
        state === 'past' && 'bg-status-done-bg text-status-done-fg ring-1 ring-border-strong',
        className ?? 'text-xs',
      )}
    >
      {state === 'now' && <PulseDot />}
      {state === 'next' && <ArrowRight className="size-[1.1em]" aria-hidden />}
      {state === 'past' && <Check className="size-[1.1em]" aria-hidden />}
      {t(state === 'now' ? 'now' : state === 'next' ? 'next' : 'done')}
    </span>
  );
}

/** Teacher or group name; a swap shows the substitute plus "Substitute for …". */
export function WhoName({ who, className, subClassName, wrap }: { who: Who | null; className?: string; subClassName?: string; wrap?: boolean }) {
  const { t, lang } = useI18n();
  if (!who) return <span className={cx('text-muted-foreground', className)}>—</span>;
  return (
    <span className={cx('flex min-w-0 flex-col', className)}>
      <span className={cx('flex min-w-0 gap-[0.35em]', wrap ? 'items-start' : 'items-center')}>
        {who.group && <Users className={cx('size-[0.9em] shrink-0 text-muted-foreground', wrap && 'mt-[0.15em]')} aria-hidden />}
        <span className={wrap ? 'line-clamp-2' : 'truncate'}>{whoText(who, lang)}</span>
      </span>
      {who.override && (
        <span className={cx('mt-[0.2em] inline-flex items-center gap-[0.35em] self-start rounded-sm bg-accent-tint px-[0.45em] py-[0.15em] font-semibold text-foreground ring-1 ring-accent/30', subClassName ?? 'text-xs')}>
          <Repeat className="size-[1em] shrink-0 text-accent" aria-hidden />
          {who.planned ? t('substituteFor', { name: plannedText(who, lang) }) : t('substitute')}
        </span>
      )}
    </span>
  );
}
