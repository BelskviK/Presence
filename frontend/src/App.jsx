import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'react-hot-toast';

import useAuthStore from './store/authStore';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';

import LoginPage from './pages/LoginPage';
import OverviewPage from './pages/OverviewPage';
import AttendancePage from './pages/AttendancePage';
import LeavePage from './pages/LeavePage';
import SalaryPage from './pages/SalaryPage';
import ProfilePage from './pages/ProfilePage';
import EmployeesPage from './pages/EmployeesPage';
import GeofencesPage from './pages/GeofencesPage';
import ReportsPage from './pages/ReportsPage';

export default function App() {
  const { t, ready } = useTranslation();
  const { isAuthenticated, isLoading, init } = useAuthStore();

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading || !ready) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--color-accent-900)' }}>
        <div className="text-center">
          <div className="spinner mb-4 mx-auto"></div>
          <p style={{ color: 'var(--color-bg)', fontSize: 18 }}>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<OverviewPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/leave" element={<LeavePage />} />
          <Route
            path="/salary"
            element={
              <ProtectedRoute roles={['EMPLOYEE', 'MANAGER']}>
                <SalaryPage />
              </ProtectedRoute>
            }
          />
          <Route path="/profile" element={<ProfilePage />} />
          <Route
            path="/reports"
            element={
              <ProtectedRoute roles={['MANAGER', 'ADMIN']}>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <EmployeesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/geofences"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <GeofencesPage />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
