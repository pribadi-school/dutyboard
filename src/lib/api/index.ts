/**
 * Picks the backend. Production builds use the PHP API. `npm run dev` uses
 * demo mode (this browser's storage, admin password "demo"); `npm run dev:php`
 * (VITE_API=php) uses the PHP API through Vite's /api proxy.
 */
import { createDemoApi } from './demoApi';
import { createPhpApi } from './phpApi';

const mode = (import.meta.env.VITE_API as string | undefined) ?? (import.meta.env.DEV ? 'demo' : 'php');

export const api = mode === 'demo' ? createDemoApi() : createPhpApi();
export type { AdminAction, Api } from './api';
