<?php
/**
 * POST { password } → { csrf }. Admin sign-in.
 * Rate limit: 5 wrong passwords from one IP address lock it out for 10 minutes.
 */
declare(strict_types=1);
require __DIR__ . '/_lib.php';
require_method('POST');

const MAX_FAILS = 5;
const LOCK_MINUTES = 10;

$password = body()['password'] ?? null;
if (!is_string($password) || $password === '' || strlen($password) > 200) fail('INVALID_INPUT');

$ip = substr((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 0, 45);
q('DELETE FROM login_attempts WHERE last_at < NOW() - INTERVAL 1 DAY');
$row = q('SELECT fails, locked_until > NOW() AS locked FROM login_attempts WHERE ip = ?', [$ip])->fetch();
if ($row && (int) $row['locked'] === 1) fail('LOCKED', 429);

$hash = q("SELECT v FROM meta WHERE k = 'admin_password_hash'")->fetchColumn();
if (!$hash) fail('NOT_CONFIGURED', 503);

if (!password_verify($password, $hash)) {
    $fails = ($row ? (int) $row['fails'] : 0) + 1;
    if ($fails >= MAX_FAILS) {
        q('REPLACE INTO login_attempts (ip, fails, locked_until, last_at) VALUES (?, 0, NOW() + INTERVAL ' . LOCK_MINUTES . ' MINUTE, NOW())', [$ip]);
    } else {
        q('REPLACE INTO login_attempts (ip, fails, locked_until, last_at) VALUES (?, ?, NULL, NOW())', [$ip, $fails]);
    }
    usleep(400000);
    fail($fails >= MAX_FAILS ? 'LOCKED' : 'BAD_PASSWORD', $fails >= MAX_FAILS ? 429 : 401);
}

q('DELETE FROM login_attempts WHERE ip = ?', [$ip]);
if (password_needs_rehash($hash, PASSWORD_DEFAULT)) {
    q("UPDATE meta SET v = ? WHERE k = 'admin_password_hash'", [password_hash($password, PASSWORD_DEFAULT)]);
}
start_session();
session_regenerate_id(true);
$_SESSION['admin'] = true;
$_SESSION['last'] = time();
$_SESSION['csrf'] = bin2hex(random_bytes(32));
out(['csrf' => $_SESSION['csrf']]);
