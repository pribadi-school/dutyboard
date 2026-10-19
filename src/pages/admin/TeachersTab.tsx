/**
 * Admin → Teachers (title, name, active) and Groups ("All teachers", …,
 * with who they cover for "My duties"). A teacher or group that is still on a
 * roster can't be deleted; untick "Active" instead.
 */
import { useState } from 'react';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { Avatar, Button, Card, Field, SelectField, Segmented, Switch, cx } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { groupLabel, teacherName } from '../../lib/roster';
import type { Group, GroupScope, Teacher, Title } from '../../lib/types';
import { useAdmin } from './AdminPage';

export function TeachersTab() {
  const { t, lang } = useI18n();
  const { data } = useAdmin();
  const [teacher, setTeacher] = useState<Teacher | 'new' | null>(null);
  const [group, setGroup] = useState<Group | 'new' | null>(null);
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">{t('a_teacherList')}</h2>
          <Button size="sm" icon={<Plus className="size-4" aria-hidden />} onClick={() => setTeacher('new')}>
            {t('a_addTeacher')}
          </Button>
        </div>
        <Card className="mt-3 overflow-hidden">
          <ul className="divide-y divide-border-strong">
            {data.teachers.map((x) => (
              <li key={x.id}>
                <button type="button" onClick={() => setTeacher(x)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface-page">
                  <Avatar text={x.name.slice(0, 2).toUpperCase()} size="sm" muted={!x.active} />
                  <span className={cx('min-w-0 flex-1 text-base font-semibold', x.active ? 'text-foreground' : 'text-muted-foreground')}>
                    {teacherName(x)}
                    {!x.active && <span className="ml-2 text-sm font-normal">({t('a_inactive')})</span>}
                  </span>
                  <Pencil className="size-4 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">{t('a_groupList')}</h2>
          <Button size="sm" icon={<Plus className="size-4" aria-hidden />} onClick={() => setGroup('new')}>
            {t('a_addGroup')}
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t('a_groupsLead')}</p>
        <Card className="mt-3 overflow-hidden">
          <ul className="divide-y divide-border-strong">
            {data.groups.map((g) => (
              <li key={g.id}>
                <button type="button" onClick={() => setGroup(g)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface-page">
                  <Users className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-foreground">{groupLabel(g, lang)}</span>
                    <span className="block text-sm text-muted-foreground">{t('a_scope')}: {t(`a_scope_${g.scope}`)}</span>
                  </span>
                  <Pencil className="size-4 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {teacher && <TeacherSheet teacher={teacher === 'new' ? undefined : teacher} onClose={() => setTeacher(null)} />}
      {group && <GroupSheet group={group === 'new' ? undefined : group} onClose={() => setGroup(null)} />}
    </div>
  );
}

function TeacherSheet({ teacher, onClose }: { teacher?: Teacher; onClose: () => void }) {
  const { t } = useI18n();
  const { run } = useAdmin();
  const [title, setTitle] = useState<Title>(teacher?.title ?? 'Ms.');
  const [name, setName] = useState(teacher?.name ?? '');
  const [active, setActive] = useState(teacher?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const save = async () => {
    setBusy(true);
    const ok = await run({ action: 'teacher.save', id: teacher?.id, title, name, active }, t('saved'));
    setBusy(false);
    if (ok) onClose();
  };
  const remove = async () => {
    if (!teacher) return;
    if (!confirming) return setConfirming(true);
    if (await run({ action: 'teacher.delete', id: teacher.id }, t('saved'))) onClose();
  };
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={teacher ? t('a_editTeacher') : t('a_addTeacher')}
      footer={
        <div className="flex flex-wrap gap-2">
          {teacher && (
            <Button variant="danger" onClick={remove} icon={<Trash2 className="size-4" aria-hidden />}>
              {confirming ? t('a_confirm') : t('a_deleteTeacher')}
            </Button>
          )}
          <Button className="ml-auto" onClick={save} loading={busy} disabled={!name.trim()}>
            {t('save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-semibold text-foreground">{t('a_title_')}</p>
          <Segmented label={t('a_title_')} value={title} onChange={setTitle} options={[{ value: 'Ms.', label: 'Ms.' }, { value: 'Mr.', label: 'Mr.' }]} />
        </div>
        <Field label={t('a_name')} placeholder={t('a_namePh')} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <label className="flex min-h-12 items-center justify-between gap-3 text-base font-semibold">
          <span aria-hidden>{t('a_active')}</span>
          <Switch checked={active} onChange={setActive} label={t('a_active')} />
        </label>
      </div>
    </BottomSheet>
  );
}

function GroupSheet({ group, onClose }: { group?: Group; onClose: () => void }) {
  const { t } = useI18n();
  const { run } = useAdmin();
  const [en, setEn] = useState(group?.labelEn ?? '');
  const [id, setId] = useState(group?.labelId ?? '');
  const [scope, setScope] = useState<GroupScope>(group?.scope ?? 'none');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const save = async () => {
    setBusy(true);
    const ok = await run({ action: 'group.save', id: group?.id, labelEn: en, labelId: id, scope }, t('saved'));
    setBusy(false);
    if (ok) onClose();
  };
  const remove = async () => {
    if (!group) return;
    if (!confirming) return setConfirming(true);
    if (await run({ action: 'group.delete', id: group.id }, t('saved'))) onClose();
  };
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={group ? t('a_editGroup') : t('a_addGroup')}
      footer={
        <div className="flex flex-wrap gap-2">
          {group && (
            <Button variant="danger" onClick={remove} icon={<Trash2 className="size-4" aria-hidden />}>
              {confirming ? t('a_confirm') : t('a_deleteGroup')}
            </Button>
          )}
          <Button className="ml-auto" onClick={save} loading={busy} disabled={!en.trim() || !id.trim()}>
            {t('save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label={t('a_groupEn')} value={en} onChange={(e) => setEn(e.target.value)} maxLength={120} />
        <Field label={t('a_groupId')} value={id} onChange={(e) => setId(e.target.value)} maxLength={120} />
        <SelectField
          label={t('a_scope')}
          value={scope}
          onChange={(v) => setScope(v as GroupScope)}
          options={(['all', 'male', 'female', 'none'] as const).map((s) => ({ value: s, label: t(`a_scope_${s}`) }))}
        />
      </div>
    </BottomSheet>
  );
}
