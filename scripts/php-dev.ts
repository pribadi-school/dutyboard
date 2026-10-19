/**
 * Local PHP API for `npm run dev:php`: PHP's built-in server on 127.0.0.1:8000,
 * serving api/*.php, with DUTY_CONFIG pointing at ./duty-config.local.php
 * (git-ignored; copy duty-config.example.php and fill in your local MySQL).
 * Run: npm run php   (needs `php` on the PATH)
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const config = resolve('duty-config.local.php');
if (!existsSync(config)) {
  console.error('\n✗ duty-config.local.php is missing. Copy duty-config.example.php to it and fill in your local MySQL database.\n');
  process.exit(1);
}
const php = spawn('php', ['-S', '127.0.0.1:8000', '-t', '.'], { stdio: 'inherit', env: { ...process.env, DUTY_CONFIG: config } });
php.on('exit', (code) => process.exit(code ?? 0));
