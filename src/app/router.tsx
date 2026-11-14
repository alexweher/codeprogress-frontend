import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../features/auth/ui/ProtectedRoute';
import { PublicOnlyRoute } from '../features/auth/ui/PublicOnlyRoute';
import { AppPage } from '../pages/AppPage/AppPage';
import { DashboardPage } from '../pages/DashboardPage/DashboardPage';
import { LoginPage } from '../pages/LoginPage/LoginPage';
import { RegisterPage } from '../pages/RegisterPage/RegisterPage';
import { TopicsPage } from '../pages/TopicsPage/TopicsPage';
import { TopicDetailsPage } from '../pages/TopicDetailsPage/TopicDetailsPage';
import { LearningTaskDetailsPage } from '../pages/LearningTaskDetailsPage/LearningTaskDetailsPage';
import { StudySessionDetailsPage } from '../pages/StudySessionDetailsPage/StudySessionDetailsPage';
import { SettingsPage } from '../pages/SettingsPage/SettingsPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppPage />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="topics" element={<TopicsPage />} />
        <Route path="topics/:topicId" element={<TopicDetailsPage />} />
        <Route path="tasks/:taskId" element={<LearningTaskDetailsPage />} />
        <Route path="sessions/:sessionId" element={<StudySessionDetailsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
