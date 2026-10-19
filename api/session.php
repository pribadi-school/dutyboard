<?php
/** GET → { admin, csrf }: is this browser signed in as admin (and its CSRF token)? */
declare(strict_types=1);
require __DIR__ . '/_lib.php';
require_method('GET');
$admin = is_admin();
out(['admin' => $admin, 'csrf' => $admin ? $_SESSION['csrf'] : null]);
