<?php
/** POST → sign this browser out of admin. */
declare(strict_types=1);
require __DIR__ . '/_lib.php';
require_method('POST');
start_session();
$_SESSION = [];
session_destroy();
out(['ok' => true]);
