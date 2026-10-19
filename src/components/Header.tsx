/** Sticky app header: school mark, title, Live indicator and EN | ID toggle. */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useLive } from '../lib/live';
import { fmtClock } from '../lib/time';
import { NavMenu } from './NavMenu';
import { cx } from './ui';

export function LiveIndicator({ className }: { className?: string }) {
  const { t } = useI18n();
  const { offline, updatedAt } = useLive();
  const connected = !offline;
  const offlineText = updatedAt ? t('offlineSince', { time: fmtClock(updatedAt) }) : t('offline');
  return (
    <span
      className={cx('inline-flex items-center gap-1.5 text-xs font-semibold', connected ? 'text-foreground' : 'text-muted-foreground', className)}
      role="status"
      aria-label={connected ? `${t('live')}. ${t('liveHelp')}` : offlineText}
      title={connected ? t('liveHelp') : offlineText}
    >
      <span className="relative inline-flex size-2" aria-hidden>
        {connected && <span className="absolute inline-flex size-full rounded-full bg-live animate-live-ping" />}
        <span className={cx('relative inline-flex size-2 rounded-full', connected ? 'bg-live' : 'bg-muted-foreground')} />
      </span>
      {/* On phones only the dot shows (the label is in aria-label), to leave room for the menu. */}
      <span className="hidden sm:inline">{connected ? t('live') : t('offline')}</span>
    </span>
  );
}

export function LangToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <div role="group" aria-label={t('langLabel')} className="inline-flex rounded-md border border-border-strong p-0.5 text-xs font-bold">
      {(['en', 'id'] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          lang={l}
          aria-label={l === 'en' ? 'English' : 'Bahasa Indonesia'}
          onClick={() => setLang(l)}
          className={cx(
            'h-9 min-w-10 rounded-sm px-2 transition-[background-color,color] duration-150',
            lang === l ? 'bg-action text-on-primary' : 'text-muted-foreground hover:bg-surface-page hover:text-foreground',
          )}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** School logo (SD-SMP-SMA Pribadi, Depok 1995). */
export function SchoolLogo({ className }: { className?: string }) {
  return (
    <img
      src="/pribadi-red.png"
      alt="SD-SMP-SMA Pribadi Depok"
      width={900}
      height={252}
      className={cx('w-auto shrink-0', className ?? 'h-9')}
    />
  );
}

export function Header({ title, right, wide }: { title?: string; right?: ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  return (
    <>
      {api.mode === 'demo' && (
        <div className="no-print bg-foreground px-4 py-1.5 text-center text-[12px] font-medium text-on-primary">{t('demoBanner')}</div>
      )}
      <header className="no-print sticky top-0 z-40 border-b border-border-strong bg-surface">
        <div className={cx('mx-auto flex h-16 items-center gap-3 px-4 sm:h-[72px] sm:gap-5 sm:px-6', wide ? 'max-w-[1600px]' : 'max-w-3xl')}>
          <Link to="/" className="flex min-w-0 items-center gap-3 rounded-md py-2" aria-label={`${t('school')}, ${t('appName')}`}>
            <SchoolLogo className="h-7 sm:h-8" />
            {/* The page name shows next to the logo from tablet width up. */}
            {title && (
              <span className="hidden min-w-0 border-l border-border-strong pl-4 text-base font-bold text-foreground sm:block">
                <span className="block truncate">{title}</span>
              </span>
            )}
          </Link>
          <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
            {right}
            <LiveIndicator />
            <LangToggle />
            <NavMenu />
          </div>
        </div>
      </header>
    </>
  );
}
