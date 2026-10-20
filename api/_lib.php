<?php
/**
 * Shared helpers for the JSON API: config, PDO, JSON in/out, admin session,
 * CSRF, input validation, and the change counter the TV polls.
 *
 * Config (DB credentials) lives in duty-config.php OUTSIDE the web root:
 * the first one found walking up from the folder above the site
 * (e.g. /home/pribadisch/duty-config.php), or the path in env DUTY_CONFIG.
 * See duty-config.example.php.
 */
declare(strict_types=1);

date_default_timezone_set('Asia/Jakarta');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

set_exception_handler(function (Throwable $e): void {
    error_log('[duty-board] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    // Command-line tools (tools/*.php): show the real error, not JSON.
    if (PHP_SAPI === 'cli') {
        fwrite(STDERR, "
Error: " . $e->getMessage() . "
");
        exit(1);
    }
    // Constraint violations (unknown teacher id, duplicate name, …) are bad input, not a crash.
    if ($e instanceof PDOException && ($e->errorInfo[0] ?? '') === '23000') {
        $dup = ($e->errorInfo[1] ?? 0) === 1062;
        out(['error' => $dup ? 'DUPLICATE' : 'INVALID_INPUT'], 409);
    }
    out(['error' => 'UNKNOWN'], 500);
});

function config(): array
{
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $path = getenv('DUTY_CONFIG') ?: null;
    if (!$path) {
        // Start above the site folder: the config must never be inside it.
        $dir = dirname(__DIR__);
        while (($parent = dirname($dir)) !== $dir) {
            $dir = $parent;
            if (is_file($dir . '/duty-config.php')) {
                $path = $dir . '/duty-config.php';
                break;
            }
        }
    }
    if (!$path || !is_readable($path)) fail('NOT_CONFIGURED', 500);
    $cfg = require $path;
    if (!is_array($cfg)) fail('NOT_CONFIGURED', 500);
    return $cfg;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = config();
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $c['db_host'] ?? 'localhost', $c['db_name'] ?? '');
    $pdo = new PDO($dsn, $c['db_user'] ?? '', $c['db_pass'] ?? '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $pdo->exec("SET time_zone = '+07:00'");
    return $pdo;
}

/** Prepared statement, executed. The only way this API talks to MySQL. */
function q(string $sql, array $args = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute($args);
    return $st;
}

function out(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $code, int $status = 400): never
{
    if (PHP_SAPI === 'cli') {
        fwrite(STDERR, "
Error: $code" . ($code === 'NOT_CONFIGURED' ? ' (~/duty-config.php not found or not readable)' : '') . "
");
        exit(1);
    }
    out(['error' => $code], $status);
}

function require_method(string $method): void
{
    if ($_SERVER['REQUEST_METHOD'] !== $method) fail('INVALID_INPUT', 405);
}

/** JSON request body (max 64 KB). */
function body(): array
{
    $raw = file_get_contents('php://input', false, null, 0, 65536);
    $data = json_decode($raw ?: '{}', true);
    if (!is_array($data)) fail('INVALID_INPUT');
    return $data;
}

/** The change counter: every write bumps it, the TV polls it (api/version.php). */
function version(): int
{
    return (int) (q("SELECT v FROM meta WHERE k = 'version'")->fetchColumn() ?: 0);
}

function bump(): int
{
    q("INSERT INTO meta (k, v) VALUES ('version', '1') ON DUPLICATE KEY UPDATE v = CAST(v AS UNSIGNED) + 1");
    return version();
}

// ---------- Admin session ----------

const SESSION_IDLE = 12 * 3600;

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $https = ($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off';
    session_name('duty_admin');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
    ini_set('session.use_strict_mode', '1');
    session_start();
    if (!empty($_SESSION['admin']) && time() - (int) ($_SESSION['last'] ?? 0) > SESSION_IDLE) {
        $_SESSION = [];
    }
}

function is_admin(): bool
{
    start_session();
    return !empty($_SESSION['admin']);
}

/** Every write: signed-in admin + the CSRF token from sign-in in the X-CSRF-Token header. */
function require_admin(): void
{
    if (!is_admin()) fail('NOT_SIGNED_IN', 401);
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($sent) || !hash_equals((string) ($_SESSION['csrf'] ?? ''), $sent)) fail('CSRF', 403);
    $_SESSION['last'] = time();
}

// ---------- Input validation (every field, server-side) ----------

function v_int(mixed $v): int
{
    if (is_int($v) && $v > 0) return $v;
    if (is_string($v) && ctype_digit($v) && (int) $v > 0) return (int) $v;
    fail('INVALID_INPUT');
}

function v_opt_int(mixed $v): ?int
{
    return $v === null || $v === '' ? null : v_int($v);
}

function v_str(mixed $v, int $max, bool $allowEmpty = false): string
{
    if (!is_string($v)) fail('INVALID_INPUT');
    $v = trim(preg_replace('/\s+/u', ' ', $v) ?? '');
    if ((!$allowEmpty && $v === '') || mb_strlen($v) > $max) fail('INVALID_INPUT');
    return $v;
}

function v_date(mixed $v): string
{
    if (!is_string($v) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $v, $m) || !checkdate((int) $m[2], (int) $m[3], (int) $m[1])) fail('INVALID_INPUT');
    return $v;
}

/** "07:15" → "07:15:00" */
function v_time(mixed $v): string
{
    if (!is_string($v) || !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $v)) fail('INVALID_INPUT');
    return $v . ':00';
}

function v_weekday(mixed $v): int
{
    $d = v_int($v);
    if ($d > 5) fail('INVALID_INPUT');
    return $d;
}

function v_enum(mixed $v, array $allowed): string
{
    if (!is_string($v) || !in_array($v, $allowed, true)) fail('INVALID_INPUT');
    return $v;
}

function v_bool(mixed $v): bool
{
    if (!is_bool($v)) fail('INVALID_INPUT');
    return $v;
}
