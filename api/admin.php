<?php
/**
 * POST { action, ... } → { ok, version, id? }. Every admin write goes through here.
 * Requires the admin session + X-CSRF-Token; validates every field; runs in a
 * transaction; bumps the change counter so TVs refresh within ~5 s.
 * Actions mirror src/lib/api/api.ts (and demoApi.ts).
 */
declare(strict_types=1);
require __DIR__ . '/_lib.php';
require_method('POST');
require_admin();

$in = body();
$action = is_string($in['action'] ?? null) ? $in['action'] : '';

/** Rewrite sort = 1..n for a list of ids in their new order. */
function resort(string $table, array $ids): void
{
    foreach (array_values($ids) as $i => $id) q("UPDATE $table SET sort = ? WHERE id = ?", [$i + 1, $id]);
}

function v_dir(mixed $v): int
{
    if ($v !== 1 && $v !== -1) fail('INVALID_INPUT');
    return $v;
}

/** Move one row up (-1) or down (+1) among its siblings. */
function move(string $table, string $parentCol, int $id, int $dir): void
{
    $parent = q("SELECT $parentCol FROM $table WHERE id = ?", [$id])->fetchColumn();
    if ($parent === false) fail('NOT_FOUND', 404);
    $ids = array_map('intval', q("SELECT id FROM $table WHERE $parentCol = ? ORDER BY sort, id", [$parent])->fetchAll(PDO::FETCH_COLUMN));
    $i = array_search($id, $ids, true);
    $j = $i + $dir;
    if ($j < 0 || $j >= count($ids)) return;
    [$ids[$i], $ids[$j]] = [$ids[$j], $ids[$i]];
    resort($table, $ids);
}

function exists(string $table, int $id): void
{
    if (!q("SELECT 1 FROM $table WHERE id = ?", [$id])->fetchColumn()) fail('NOT_FOUND', 404);
}

function next_sort(string $table, string $parentCol, int $parent): int
{
    return (int) q("SELECT COALESCE(MAX(sort), 0) + 1 FROM $table WHERE $parentCol = ?", [$parent])->fetchColumn();
}

/** Validated time windows: [{ weekday: null|1..5, start: "HH:MM", end: "HH:MM" }], at most 10. */
function v_times(mixed $v): array
{
    if (!is_array($v) || count($v) > 10) fail('INVALID_INPUT');
    $out = [];
    foreach ($v as $t) {
        if (!is_array($t)) fail('INVALID_INPUT');
        $start = v_time($t['start'] ?? null);
        $end = v_time($t['end'] ?? null);
        if ($end <= $start) fail('INVALID_INPUT');
        $out[] = [($t['weekday'] ?? null) === null ? null : v_weekday($t['weekday']), $start, $end];
    }
    return $out;
}

$pdo = db();
$pdo->beginTransaction();
$result = [];

switch ($action) {
    // ---------- Teachers ----------
    case 'teacher.save': {
        $title = v_enum($in['title'] ?? null, ['Ms.', 'Mr.']);
        $name = v_str($in['name'] ?? null, 80);
        $active = v_bool($in['active'] ?? true);
        $id = v_opt_int($in['id'] ?? null);
        if ($id) {
            exists('teachers', $id);
            q('UPDATE teachers SET title = ?, name = ?, active = ? WHERE id = ?', [$title, $name, (int) $active, $id]);
        } else {
            q('INSERT INTO teachers (title, name, active) VALUES (?, ?, ?)', [$title, $name, (int) $active]);
            $id = (int) $pdo->lastInsertId();
        }
        $result['id'] = $id;
        break;
    }
    case 'teacher.delete': {
        $id = v_int($in['id'] ?? null);
        $used = q('SELECT (SELECT COUNT(*) FROM assignments WHERE teacher_id = ?) + (SELECT COUNT(*) FROM overrides WHERE teacher_id = ?)', [$id, $id])->fetchColumn();
        if ((int) $used > 0) fail('TEACHER_IN_USE', 409);
        q('DELETE FROM teachers WHERE id = ?', [$id]);
        break;
    }

    // ---------- Groups ----------
    case 'group.save': {
        $en = v_str($in['labelEn'] ?? null, 120);
        $idLabel = v_str($in['labelId'] ?? null, 120);
        $scope = v_enum($in['scope'] ?? null, ['all', 'male', 'female', 'none']);
        $id = v_opt_int($in['id'] ?? null);
        if ($id) {
            exists('duty_groups', $id);
            q('UPDATE duty_groups SET label_en = ?, label_id = ?, scope = ? WHERE id = ?', [$en, $idLabel, $scope, $id]);
        } else {
            $sort = (int) q('SELECT COALESCE(MAX(sort), 0) + 1 FROM duty_groups')->fetchColumn();
            q('INSERT INTO duty_groups (label_en, label_id, scope, sort) VALUES (?, ?, ?, ?)', [$en, $idLabel, $scope, $sort]);
            $id = (int) $pdo->lastInsertId();
        }
        $result['id'] = $id;
        break;
    }
    case 'group.delete': {
        $id = v_int($in['id'] ?? null);
        if ((int) q('SELECT COUNT(*) FROM assignments WHERE group_id = ?', [$id])->fetchColumn() > 0) fail('GROUP_IN_USE', 409);
        q('DELETE FROM duty_groups WHERE id = ?', [$id]);
        break;
    }

    // ---------- Roster versions ----------
    case 'roster.save': {
        $title = v_str($in['title'] ?? null, 160);
        $released = v_date($in['releasedOn'] ?? null);
        $effective = v_date($in['effectiveFrom'] ?? null);
        $id = v_opt_int($in['id'] ?? null);
        if ($id) {
            exists('rosters', $id);
            q('UPDATE rosters SET title = ?, released_on = ?, effective_from = ? WHERE id = ?', [$title, $released, $effective, $id]);
        } else {
            q('INSERT INTO rosters (title, released_on, effective_from) VALUES (?, ?, ?)', [$title, $released, $effective]);
            $id = (int) $pdo->lastInsertId();
        }
        $result['id'] = $id;
        break;
    }
    case 'roster.copy': {
        // A full copy (sections, duties, times, cells) as a new version.
        $from = v_int($in['id'] ?? null);
        exists('rosters', $from);
        q('INSERT INTO rosters (title, released_on, effective_from) VALUES (?, ?, ?)', [
            v_str($in['title'] ?? null, 160), v_date($in['releasedOn'] ?? null), v_date($in['effectiveFrom'] ?? null),
        ]);
        $to = (int) $pdo->lastInsertId();
        foreach (q('SELECT id, name_en, name_id, sort FROM sections WHERE roster_id = ? ORDER BY sort, id', [$from])->fetchAll() as $s) {
            q('INSERT INTO sections (roster_id, name_en, name_id, sort) VALUES (?, ?, ?, ?)', [$to, $s['name_en'], $s['name_id'], $s['sort']]);
            $newSection = (int) $pdo->lastInsertId();
            foreach (q('SELECT id, label, note, timing, sort FROM duties WHERE section_id = ? ORDER BY sort, id', [$s['id']])->fetchAll() as $d) {
                q('INSERT INTO duties (section_id, label, note, timing, sort) VALUES (?, ?, ?, ?, ?)', [$newSection, $d['label'], $d['note'], $d['timing'], $d['sort']]);
                $newDuty = (int) $pdo->lastInsertId();
                q('INSERT INTO duty_times (duty_id, weekday, start_time, end_time) SELECT ?, weekday, start_time, end_time FROM duty_times WHERE duty_id = ?', [$newDuty, $d['id']]);
                q('INSERT INTO assignments (duty_id, weekday, teacher_id, group_id) SELECT ?, weekday, teacher_id, group_id FROM assignments WHERE duty_id = ?', [$newDuty, $d['id']]);
            }
        }
        $result['id'] = $to;
        break;
    }
    case 'roster.delete': {
        $id = v_int($in['id'] ?? null);
        if ((int) q('SELECT COUNT(*) FROM rosters')->fetchColumn() <= 1) fail('LAST_ROSTER', 409);
        q('DELETE FROM rosters WHERE id = ?', [$id]);
        break;
    }

    // ---------- Sections ----------
    case 'section.save': {
        $en = v_str($in['nameEn'] ?? null, 80);
        $idName = v_str($in['nameId'] ?? null, 80);
        $id = v_opt_int($in['id'] ?? null);
        if ($id) {
            exists('sections', $id);
            q('UPDATE sections SET name_en = ?, name_id = ? WHERE id = ?', [$en, $idName, $id]);
        } else {
            $roster = v_int($in['rosterId'] ?? null);
            exists('rosters', $roster);
            q('INSERT INTO sections (roster_id, name_en, name_id, sort) VALUES (?, ?, ?, ?)', [$roster, $en, $idName, next_sort('sections', 'roster_id', $roster)]);
            $id = (int) $pdo->lastInsertId();
        }
        $result['id'] = $id;
        break;
    }
    case 'section.delete':
        q('DELETE FROM sections WHERE id = ?', [v_int($in['id'] ?? null)]);
        break;
    case 'section.move':
        move('sections', 'roster_id', v_int($in['id'] ?? null), v_dir($in['dir'] ?? null));
        break;

    // ---------- Duties (rows) ----------
    case 'duty.save': {
        $section = v_int($in['sectionId'] ?? null);
        $label = v_str($in['label'] ?? null, 200);
        $note = v_str($in['note'] ?? '', 300, true);
        $timing = v_enum($in['timing'] ?? null, ['fixed', 'approx', 'untimed']);
        $times = v_times($in['times'] ?? []);
        $roster = q('SELECT roster_id FROM sections WHERE id = ?', [$section])->fetchColumn();
        if ($roster === false) fail('NOT_FOUND', 404);
        $id = v_opt_int($in['id'] ?? null);
        if ($id) {
            $old = q('SELECT d.section_id, s.roster_id FROM duties d JOIN sections s ON s.id = d.section_id WHERE d.id = ?', [$id])->fetch();
            if (!$old) fail('NOT_FOUND', 404);
            // A row can move to another section of the same version, not to another version.
            if ((int) $old['roster_id'] !== (int) $roster) fail('INVALID_INPUT');
            $sort = (int) $old['section_id'] === $section ? null : next_sort('duties', 'section_id', $section);
            q('UPDATE duties SET section_id = ?, label = ?, note = ?, timing = ?, sort = COALESCE(?, sort) WHERE id = ?', [$section, $label, $note, $timing, $sort, $id]);
            q('DELETE FROM duty_times WHERE duty_id = ?', [$id]);
        } else {
            q('INSERT INTO duties (section_id, label, note, timing, sort) VALUES (?, ?, ?, ?, ?)', [$section, $label, $note, $timing, next_sort('duties', 'section_id', $section)]);
            $id = (int) $pdo->lastInsertId();
        }
        foreach ($times as [$weekday, $start, $end]) {
            q('INSERT INTO duty_times (duty_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)', [$id, $weekday, $start, $end]);
        }
        $result['id'] = $id;
        break;
    }
    case 'duty.delete':
        q('DELETE FROM duties WHERE id = ?', [v_int($in['id'] ?? null)]);
        break;
    case 'duty.move':
        move('duties', 'section_id', v_int($in['id'] ?? null), v_dir($in['dir'] ?? null));
        break;

    // ---------- Cells ----------
    case 'cell.set': {
        // One or more days of one row: a teacher, a group, or empty (both null).
        $duty = v_int($in['dutyId'] ?? null);
        exists('duties', $duty);
        $days = $in['weekdays'] ?? null;
        if (!is_array($days) || !$days || count($days) > 5) fail('INVALID_INPUT');
        $days = array_unique(array_map('v_weekday', $days));
        $teacher = v_opt_int($in['teacherId'] ?? null);
        $group = v_opt_int($in['groupId'] ?? null);
        if ($teacher && $group) fail('INVALID_INPUT');
        foreach ($days as $day) {
            if (!$teacher && !$group) {
                q('DELETE FROM assignments WHERE duty_id = ? AND weekday = ?', [$duty, $day]);
            } else {
                q('REPLACE INTO assignments (duty_id, weekday, teacher_id, group_id) VALUES (?, ?, ?, ?)', [$duty, $day, $teacher, $group]);
            }
        }
        break;
    }

    // ---------- Swap for one day ----------
    case 'override.set': {
        $date = v_date($in['date'] ?? null);
        $duty = v_int($in['dutyId'] ?? null);
        $teacher = v_int($in['teacherId'] ?? null);
        $note = v_str($in['note'] ?? '', 200, true);
        exists('duties', $duty);
        q('INSERT INTO overrides (on_date, duty_id, teacher_id, note) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE teacher_id = VALUES(teacher_id), note = VALUES(note)', [$date, $duty, $teacher, $note]);
        break;
    }
    case 'override.delete':
        q('DELETE FROM overrides WHERE id = ?', [v_int($in['id'] ?? null)]);
        break;

    // ---------- Admin password ----------
    case 'password.change': {
        $current = $in['current'] ?? null;
        $next = $in['next'] ?? null;
        if (!is_string($current) || !is_string($next)) fail('INVALID_INPUT');
        if (strlen($next) < 8 || strlen($next) > 200) fail('PASSWORD_TOO_SHORT');
        $hash = q("SELECT v FROM meta WHERE k = 'admin_password_hash'")->fetchColumn();
        if (!$hash || !password_verify($current, $hash)) fail('BAD_PASSWORD', 401);
        q("UPDATE meta SET v = ? WHERE k = 'admin_password_hash'", [password_hash($next, PASSWORD_DEFAULT)]);
        $pdo->commit();
        out(['ok' => true, 'version' => version()]);
    }

    default:
        fail('INVALID_INPUT');
}

$version = bump();
$pdo->commit();
out(['ok' => true, 'version' => $version] + $result);
