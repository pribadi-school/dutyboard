/**
 * Admin → Versions: every roster version with its dates. The display uses the
 * newest one whose "in use from" date has arrived, so a new term's roster can
 * be prepared ahead: copy the current version, change its dates, edit it.
 */
import { useState } from 'react';
import { Copy, Pencil, Table2, Trash2 } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { Button, Card, Field, Notice } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { fmtDate } from '../../lib/time';
import type { Roster } from '../../lib/types';
import { VersionTag, useAdmin } from './AdminPage';
import { versionStatus } from './RosterTab';

export function VersionsTab() {
  const { t, lang } = useI18n();
  const { data, today, openRoster } = useAdmin();
  const [sheet, setSheet] = useState<{ mode: 'edit' | 'copy'; roster: Roster } | null>(null);
  const date = (d: string) => fmtDate(d, lang, { day: 'numeric', month: 'short', year: 'numeric' });
  const list = [...data.rosters].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.id - a.id);
  return (
    <div>
      <p className="max-w-2xl text-base text-muted-foreground">{t('a_versionsLead')}</p>
      <ul className="mt-4 space-y-3">
        {list.map((r) => (
          <li key={r.id}>
            <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-bold text-foreground">{r.title}</p>
                  <VersionTag status={versionStatus(data.rosters, r, today)} date={date(r.effectiveFrom)} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('a_effective')}: {date(r.effectiveFrom)} · {t('a_released')}: {date(r.releasedOn)} · {t('a_duties', { n: r.duties.length })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" icon={<Table2 className="size-4" aria-hidden />} onClick={() => openRoster(r.id)}>
                  {t('a_openRoster')}
                </Button>
                <Button variant="secondary" size="sm" icon={<Copy className="size-4" aria-hidden />} onClick={() => setSheet({ mode: 'copy', roster: r })}>
                  {t('a_copyVersion')}
                </Button>
                <Button variant="ghost" size="sm" icon={<Pencil className="size-4" aria-hidden />} onClick={() => setSheet({ mode: 'edit', roster: r })}>
                  {t('edit')}
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {sheet && <VersionSheet {...sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}

function VersionSheet({ mode, roster, onClose }: { mode: 'edit' | 'copy'; roster: Roster; onClose: () => void }) {
  const { t, lang } = useI18n();
  const { data, today, run, openRoster } = useAdmin();
  const [title, setTitle] = useState(roster.title);
  const [released, setReleased] = useState(mode === 'copy' ? today : roster.releasedOn);
  const [effective, setEffective] = useState(mode === 'copy' ? today : roster.effectiveFrom);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const bad = !title.trim() || !released || !effective;
  const save = async () => {
    setBusy(true);
    const res =
      mode === 'copy'
        ? await run({ action: 'roster.copy', id: roster.id, title, releasedOn: released, effectiveFrom: effective }, t('saved'))
        : await run({ action: 'roster.save', id: roster.id, title, releasedOn: released, effectiveFrom: effective }, t('saved'));
    setBusy(false);
    if (!res) return;
    onClose();
    if (mode === 'copy' && typeof res === 'number') openRoster(res);
  };
  const remove = async () => {
    if (!confirming) return setConfirming(true);
    if (await run({ action: 'roster.delete', id: roster.id }, t('saved'))) onClose();
  };
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={mode === 'copy' ? t('a_copyTitle', { title: roster.title }) : t('a_editVersion')}
      footer={
        <div className="flex flex-wrap gap-2">
          {mode === 'edit' && data.rosters.length > 1 && (
            <Button variant="danger" onClick={remove} icon={<Trash2 className="size-4" aria-hidden />}>
              {confirming ? t('a_confirm') : t('a_deleteVersion')}
            </Button>
          )}
          <Button className="ml-auto" onClick={save} loading={busy} disabled={bad}>
            {t('save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {confirming && <Notice tone="error">{t('a_deleteVersionConfirm', { title: roster.title, date: fmtDate(roster.effectiveFrom, lang) })}</Notice>}
        <Field label={t('a_versionTitle')} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
        <Field label={t('a_effective')} type="date" value={effective} onChange={(e) => setEffective(e.target.value)} />
        <Field label={t('a_released')} type="date" value={released} onChange={(e) => setReleased(e.target.value)} />
      </div>
    </BottomSheet>
  );
}
