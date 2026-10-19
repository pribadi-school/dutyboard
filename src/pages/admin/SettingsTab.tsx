/**
 * Admin → Settings: change the admin password (PHP mode), reset the demo
 * data (demo mode), and the links to put on the TV / share with teachers.
 */
import { useState, type FormEvent } from 'react';
import { CalendarDays, Printer, RotateCcw, Tv } from 'lucide-react';
import { Button, Card, Field } from '../../components/ui';
import { api } from '../../lib/api';
import { resetDemo } from '../../lib/api/demoApi';
import { useI18n } from '../../lib/i18n';
import { useLive } from '../../lib/live';
import { useAdmin } from './AdminPage';

export function SettingsTab() {
  const { t } = useI18n();
  const { run } = useAdmin();
  const { refresh } = useLive();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await run({ action: 'password.change', current, next }, t('a_pwSaved'));
    setBusy(false);
    if (ok) {
      setCurrent('');
      setNext('');
    }
  };
  const origin = window.location.origin;
  const links = [
    { href: '/', label: t('nav_tv'), icon: Tv },
    { href: '/week', label: t('nav_week'), icon: CalendarDays },
    { href: '/print', label: t('nav_print'), icon: Printer },
  ];
  return (
    <div className="grid max-w-4xl gap-6 md:grid-cols-2">
      <Card as="section" className="p-5">
        <h2 className="text-lg font-bold">{t('a_pwTitle')}</h2>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <Field label={t('a_pwCurrent')} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          <Field label={t('a_pwNew')} hint={t('a_pwNewHint')} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          <Button type="submit" loading={busy} disabled={!current || next.length < 8}>
            {t('a_pwSave')}
          </Button>
        </form>
      </Card>
      <div className="space-y-6">
        <Card as="section" className="p-5">
          <h2 className="text-lg font-bold">{t('a_links')}</h2>
          <ul className="mt-3 space-y-2">
            {links.map(({ href, label, icon: Icon }) => (
              <li key={href} className="flex items-center gap-3">
                <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{label}</span>
                  <a href={href} className="block truncate text-sm text-action underline-offset-2 hover:underline">
                    {origin}
                    {href}
                  </a>
                </span>
              </li>
            ))}
          </ul>
        </Card>
        {api.mode === 'demo' && (
          <Card as="section" className="p-5">
            <h2 className="text-lg font-bold">{t('a_resetDemo')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('a_resetDemoHint')}</p>
            <Button
              variant="danger"
              className="mt-4"
              icon={<RotateCcw className="size-4" aria-hidden />}
              onClick={() => {
                resetDemo();
                refresh();
              }}
            >
              {t('a_resetDemo')}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
