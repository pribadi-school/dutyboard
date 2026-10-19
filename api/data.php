<?php
/**
 * GET → everything public, in one response (a few KB): teachers, groups,
 * every roster version with its sections/duties/times/cells, and the
 * "today only" swaps from yesterday on. Names and duties only, nothing private.
 */
declare(strict_types=1);
require __DIR__ . '/_lib.php';
require_method('GET');

$hm = fn (string $t): string => substr($t, 0, 5);

$teachers = array_map(fn ($r) => [
    'id' => (int) $r['id'], 'title' => $r['title'], 'name' => $r['name'], 'active' => (bool) $r['active'],
], q('SELECT id, title, name, active FROM teachers ORDER BY name, id')->fetchAll());

$groups = array_map(fn ($r) => [
    'id' => (int) $r['id'], 'labelEn' => $r['label_en'], 'labelId' => $r['label_id'], 'scope' => $r['scope'],
], q('SELECT id, label_en, label_id, scope FROM duty_groups ORDER BY sort, id')->fetchAll());

$rosters = [];
foreach (q('SELECT id, title, released_on, effective_from FROM rosters ORDER BY effective_from DESC, id DESC')->fetchAll() as $r) {
    $rosters[(int) $r['id']] = [
        'id' => (int) $r['id'], 'title' => $r['title'], 'releasedOn' => $r['released_on'], 'effectiveFrom' => $r['effective_from'],
        'sections' => [], 'duties' => [], 'assignments' => [],
    ];
}

foreach (q('SELECT id, roster_id, name_en, name_id, sort FROM sections ORDER BY sort, id')->fetchAll() as $r) {
    $rosters[(int) $r['roster_id']]['sections'][] = ['id' => (int) $r['id'], 'nameEn' => $r['name_en'], 'nameId' => $r['name_id'], 'sort' => (int) $r['sort']];
}

$times = [];
foreach (q('SELECT duty_id, weekday, start_time, end_time FROM duty_times ORDER BY weekday IS NOT NULL, weekday, start_time')->fetchAll() as $r) {
    $times[(int) $r['duty_id']][] = ['weekday' => $r['weekday'] === null ? null : (int) $r['weekday'], 'start' => $hm($r['start_time']), 'end' => $hm($r['end_time'])];
}

$dutyRoster = [];
foreach (q('SELECT d.id, d.section_id, s.roster_id, d.label, d.note, d.timing, d.sort FROM duties d JOIN sections s ON s.id = d.section_id ORDER BY d.sort, d.id')->fetchAll() as $r) {
    $id = (int) $r['id'];
    $dutyRoster[$id] = (int) $r['roster_id'];
    $rosters[(int) $r['roster_id']]['duties'][] = [
        'id' => $id, 'sectionId' => (int) $r['section_id'], 'label' => $r['label'], 'note' => $r['note'],
        'timing' => $r['timing'], 'sort' => (int) $r['sort'], 'times' => $times[$id] ?? [],
    ];
}

foreach (q('SELECT duty_id, weekday, teacher_id, group_id FROM assignments ORDER BY duty_id, weekday')->fetchAll() as $r) {
    $rosters[$dutyRoster[(int) $r['duty_id']]]['assignments'][] = [
        'dutyId' => (int) $r['duty_id'], 'weekday' => (int) $r['weekday'],
        'teacherId' => $r['teacher_id'] === null ? null : (int) $r['teacher_id'],
        'groupId' => $r['group_id'] === null ? null : (int) $r['group_id'],
    ];
}

$overrides = array_map(fn ($r) => [
    'id' => (int) $r['id'], 'date' => $r['on_date'], 'dutyId' => (int) $r['duty_id'], 'teacherId' => (int) $r['teacher_id'], 'note' => $r['note'],
], q('SELECT id, on_date, duty_id, teacher_id, note FROM overrides WHERE on_date >= CURDATE() - INTERVAL 1 DAY ORDER BY on_date, duty_id')->fetchAll());

out([
    'version' => version(),
    'teachers' => $teachers,
    'groups' => $groups,
    'rosters' => array_values($rosters),
    'overrides' => $overrides,
]);
