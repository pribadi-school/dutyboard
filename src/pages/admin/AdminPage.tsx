/**
 * /admin — password sign-in (PHP session; demo: "demo"), then tabs:
 * Roster (edit the grid like a spreadsheet) · Swaps (one-day substitutes) ·
 * Teachers (and groups) · Versions (effective dates, copy) · Settings.
 * Every save bumps the change counter, so TVs update within ~5 s.
 */
import { createContext, useCallback, useContext, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { CalendarClock, History, LogOut, Repeat, Settings, Table2, Users } from 'lucide-react';
import { Header } from '../../components/Header';
import { useToast } from '../../components/Toast';
import { Button, Field, Notice, Skeleton, cx } from '../../components/ui';
import { api, type AdminAction } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useLive, useNow } from '../../lib/live';
import { rosterFor } from '../../lib/roster';
import { jakarta } from '../../lib/time';
import { errorCode, type BoardData, type ErrorCode } from '../../lib/types';
import { RosterTab } from './RosterTab';
import { SettingsTab } from './SettingsTab';
import { SwapsTab } from './SwapsTab';
import { TeachersTab } from './TeachersTab';
import { VersionsTab } from './VersionsTab';

type AdminCtx = {
  data: BoardData;
  today: string;
  /** Run an admin write; refreshes the data and shows a toast. Resolves to the new id (if any) or false on error. */
  run: (a: AdminAction, okText?: string) => Promise<number | true | false>;
  /** Open the Roster tab on a version. */
  openRoster: (id: number) => void;
};
const Ctx = createContext<AdminCtx | null>(null);
export const useAdmin = () => useContext(Ctx)!;

const TABS = [
  { id: 'roster', label: 'a_tab_roster', icon: Table2 },
  { id: 'swaps', label: 'a_tab_swaps', icon: Repeat },
  { id: 'teachers', label: 'a_tab_teachers', icon: Users },
  { id: 'versions', label: 'a_tab_versions', icon: History },
  { id: 'settings', label: 'a_tab_settings', icon: Settings },
] as const;
type Tab = (typeof TABS)[number]['id'];

export default function AdminPage() {
  const [state, setState] = useState<'checking' | 'out' | 'in'>('checking');
  useEffect(() => {
    api.session().then(
      (ok) => setState(ok ? 'in' : 'out'),
      () => setState('out'),
    );
  }, []);
  const signOut = useCallback(() => {
    api.logout().catch(() => {});
    setState('out');
  }, []);
  if (state === 'checking') return <Shell><Skeleton className="h-64 w-full rounded-lg" /></Shell>;
  return state === 'in' ? <AdminShell onSignOut={signOut} onExpired={() => setState('out')} /> : <AdminLogin onSignIn={() => setState('in')} />;
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="min-h-dvh">
      <Header title={t('a_title')} wide={wide} />
      <main className={cx('mx-auto px-4 pt-6 pb-16 sm:px-6', wide ? 'max-w-[1400px]' : 'max-w-md')}>{children}</main>
    </div>
  );
}

function AdminLogin({ onSignIn }: { onSignIn: () => void }) {
  const { t, errorText } = useI18n();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      await api.login(password);
      onSignIn();
    } catch (err) {
      setError(errorCode(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell>
      <h1 className="text-[28px] leading-tight font-bold">{t('a_title')}</h1>
      <p className="mt-1 mb-6 text-base text-muted-foreground">{t('a_signInLead')}</p>
      <form onSubmit={submit} className="space-y-4">
        <Field
          label={t('a_password')}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error ? errorText(error) : null}
          autoFocus
        />
        <Button type="submit" block loading={busy} disabled={!password}>
          {t('a_signIn')}
        </Button>
      </form>
    </Shell>
  );
}

function AdminShell({ onSignOut, onExpired }: { onSignOut: () => void; onExpired: () => void }) {
  const { t, errorText } = useI18n();
  const { data, refresh, failed } = useLive();
  const toast = useToast();
  const { now } = useNow(60_000);
  const today = jakarta(now).date;
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((x) => x.id === params.get('tab')) ? params.get('tab') : 'roster') as Tab;
  const setTab = (id: Tab) => setParams((p) => ({ ...Object.fromEntries(p), tab: id }), { replace: true });
  const [rosterId, setRosterId] = useState<number | null>(null);

  const run = useCallback<AdminCtx['run']>(
    async (a, okText) => {
      try {
        const res = await api.admin(a);
        await refresh();
        if (okText) toast(okText, 'success');
        return res.id ?? true;
      } catch (err) {
        const code = errorCode(err);
        toast(errorText(code), 'error');
        if (code === 'NOT_SIGNED_IN' || code === 'CSRF') onExpired();
        return false;
      }
    },
    [refresh, toast, errorText, onExpired],
  );

  if (!data) {
    return (
      <Shell wide>
        {failed ? (
          <Notice tone="error" action={<Button size="sm" variant="secondary" onClick={refresh}>{t('retry')}</Button>}>
            {t('loadFailed')}
          </Notice>
        ) : (
          <Skeleton className="h-96 w-full rounded-lg" />
        )}
      </Shell>
    );
  }

  const roster = data.rosters.find((r) => r.id === rosterId) ?? rosterFor(data.rosters, today)!;
  const openRoster = (id: number) => {
    setRosterId(id);
    setTab('roster');
  };

  return (
    <Ctx.Provider value={{ data, today, run, openRoster }}>
      <Shell wide>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[28px] leading-tight font-bold">{t('a_title')}</h1>
          <Button variant="ghost" size="sm" onClick={onSignOut} icon={<LogOut className="size-4" aria-hidden />}>
            {t('a_signOut')}
          </Button>
        </div>
        <nav aria-label={t('a_title')} className="no-print mt-4 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div role="tablist" className="inline-flex min-w-full gap-1 border-b border-border-strong">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cx(
                  '-mb-px inline-flex min-h-12 items-center gap-2 border-b-2 px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-150',
                  tab === id ? 'border-action text-action' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {t(label)}
              </button>
            ))}
          </div>
        </nav>
        <div className="mt-6" role="tabpanel">
          {tab === 'roster' && <RosterTab roster={roster} onPick={setRosterId} />}
          {tab === 'swaps' && <SwapsTab />}
          {tab === 'teachers' && <TeachersTab />}
          {tab === 'versions' && <VersionsTab />}
          {tab === 'settings' && <SettingsTab />}
        </div>
      </Shell>
    </Ctx.Provider>
  );
}

/** Small "Starts 4 Jan 2027" / "In use now" / "Old" tag for a version. */
export function VersionTag({ status, date }: { status: 'current' | 'upcoming' | 'old'; date: string }) {
  const { t } = useI18n();
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        status === 'current' && 'bg-status-progress-bg text-foreground ring-1 ring-gradient-end/40',
        status === 'upcoming' && 'bg-action-tint text-action ring-1 ring-action/25',
        status === 'old' && 'bg-surface-muted text-muted-foreground',
      )}
    >
      {status === 'upcoming' && <CalendarClock className="size-3.5" aria-hidden />}
      {status === 'current' ? t('a_inUse') : status === 'upcoming' ? t('a_upcoming', { date }) : t('a_old')}
    </span>
  );
}
