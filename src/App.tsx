/**
 * Routes:
 *   /        TV display (public): who is on duty now, next up, today's list
 *   /week    the week as a grid; "my duties" filter (teachers' phones)
 *   /print   the roster laid out like the printed PDF (?roster=<id>)
 *   /admin   edit roster, swaps, teachers, versions (password)
 */
import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { ToastProvider } from './components/Toast';
import { I18nProvider } from './lib/i18n';
import { LiveProvider } from './lib/live';
import TvPage from './pages/TvPage';

const WeekPage = lazy(() => import('./pages/WeekPage'));
const PrintPage = lazy(() => import('./pages/PrintPage'));
const AdminPage = lazy(() => import('./pages/admin/AdminPage'));

export function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <LiveProvider>
          <BrowserRouter>
            <Suspense fallback={null}>
              <Routes>
                <Route path="/" element={<TvPage />} />
                <Route path="/week" element={<WeekPage />} />
                <Route path="/print" element={<PrintPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="*" element={<WeekPage />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </LiveProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
