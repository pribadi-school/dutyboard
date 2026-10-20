<?php
/**
 * Sets the admin password (first-time setup, or if it's forgotten).
 * Run on the server, in cPanel → Terminal:
 *   php ~/repositories/duty-board/tools/set-password.php
 * It asks for the new password (hidden while typing where the server allows) and stores only its
 * password_hash() in the database. Signed-in admins stay signed in.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
require __DIR__ . '/../api/_lib.php';

function ask(string $prompt): string
{
    fwrite(STDOUT, $prompt);
    // Hide typing when the server allows it (shared hosting often disables shell_exec).
    $disabled = array_map('trim', explode(',', (string) ini_get('disable_functions')));
    $tty = function_exists('stream_isatty') && stream_isatty(STDIN) && function_exists('shell_exec') && !in_array('shell_exec', $disabled, true);
    if ($tty) @shell_exec('stty -echo');
    $line = fgets(STDIN);
    if ($tty) {
        @shell_exec('stty echo');
        fwrite(STDOUT, "\n");
    }
    return rtrim((string) $line, "\r\n");
}

$pw = ask('New admin password (at least 8 characters): ');
if (strlen($pw) < 8) {
    fwrite(STDERR, "Too short. Nothing changed.\n");
    exit(1);
}
if (ask('Type it again: ') !== $pw) {
    fwrite(STDERR, "The two passwords differ. Nothing changed.\n");
    exit(1);
}
q("INSERT INTO meta (k, v) VALUES ('admin_password_hash', ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [password_hash($pw, PASSWORD_DEFAULT)]);
q('DELETE FROM login_attempts');
fwrite(STDOUT, "Admin password set.\n");
