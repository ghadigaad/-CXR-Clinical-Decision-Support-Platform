import { Route, Routes } from 'react-router-dom';

import { AppLayout } from '../components/layout/AppLayout';
import { LoginPage } from '../features/auth/LoginPage';
import { NewAnalysisPage } from '../features/analysis/NewAnalysisPage';
import { ResultsPage } from '../features/analysis/ResultsPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { NotFoundPage } from '../features/misc/NotFoundPage';
import { PatientDetailPage } from '../features/patients/PatientDetailPage';
import { PatientsPage } from '../features/patients/PatientsPage';
import { ReportPage } from '../features/reports/ReportPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { ProtectedRoute } from './ProtectedRoute';

export function App() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="analysis/new" element={<NewAnalysisPage />} />
            {/* Analyses are addressed by opaque cuid - no patient data in the URL. */}
            <Route path="analysis/:analysisId" element={<ResultsPage />} />
            <Route path="analysis/:analysisId/report" element={<ReportPage />} />
            <Route path="patients" element={<PatientsPage />} />
            <Route path="patients/:patientId" element={<PatientDetailPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
