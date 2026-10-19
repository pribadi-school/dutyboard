<?php
/** GET → { version }. Polled by the TV every ~5 s; it refetches data.php only when this changes. */
declare(strict_types=1);
require __DIR__ . '/_lib.php';
require_method('GET');
out(['version' => version()]);
