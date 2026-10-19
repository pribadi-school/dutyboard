/**
 * Talks to the PHP API (api/*.php, same origin). The admin session is a PHP
 * session cookie; every write also sends the CSRF token returned by sign-in.
 */
import { ApiError, type BoardData, type ErrorCode } from '../types';
import type { AdminAction, AdminResult, Api } from './api';

const BASE = '/api';
let csrf: string | null = null;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/${path}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...init,
      headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...init?.headers },
    });
  } catch {
    throw new ApiError('NETWORK');
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(res.ok ? 'UNKNOWN' : 'NETWORK');
  }
  if (!res.ok) throw new ApiError(((json as { error?: ErrorCode })?.error ?? 'UNKNOWN') as ErrorCode);
  return json as T;
}

const post = <T>(path: string, body: unknown) => call<T>(path, { method: 'POST', body: JSON.stringify(body) });

export function createPhpApi(): Api {
  return {
    mode: 'php',
    version: async () => (await call<{ version: number }>('version.php')).version,
    data: () => call<BoardData>('data.php'),
    session: async () => {
      const s = await call<{ admin: boolean; csrf: string | null }>('session.php');
      csrf = s.csrf;
      return s.admin;
    },
    login: async (password) => {
      csrf = (await post<{ csrf: string }>('login.php', { password })).csrf;
    },
    logout: async () => {
      await post('logout.php', {});
      csrf = null;
    },
    admin: (a: AdminAction) => post<AdminResult>('admin.php', a),
  };
}
