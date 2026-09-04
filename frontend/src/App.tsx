import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { LanguageProvider } from "./context/LanguageContext";
import { Layout } from "./components/Layout";
import { RequireAuth, RequirePermission } from "./components/RouteGuards";
import { IdleTimeoutWatcher } from "./components/IdleTimeoutWatcher";

import { WelcomePage } from "./pages/Welcome";
import { VisitorInductionPage } from "./pages/VisitorInduction";
import { LoginPage } from "./pages/Login";
import { ForgotPasswordPage } from "./pages/ForgotPassword";
import { ResetPasswordPage } from "./pages/ResetPassword";
import { VerifyCertificatePage } from "./pages/VerifyCertificate";
import { DashboardPage } from "./pages/Dashboard";
import { CourseViewPage } from "./pages/CourseView";
import { EvaluationRunnerPage } from "./pages/EvaluationRunner";
import { CertificatesPage } from "./pages/Certificates";
import { ProfilePage } from "./pages/Profile";

import { AdminDashboardPage } from "./pages/admin/AdminDashboard";
import { AdminUsersPage } from "./pages/admin/AdminUsers";
import { AdminCoursesPage } from "./pages/admin/AdminCourses";
import { AdminCourseEditorPage } from "./pages/admin/AdminCourseEditor";
import { AdminReportsPage } from "./pages/admin/AdminReports";
import { AdminAuditPage } from "./pages/admin/AdminAudit";

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
      <ToastProvider>
        <AuthProvider>
          <IdleTimeoutWatcher />
          <Routes>
            <Route path="/" element={<WelcomePage />} />
            <Route path="/induccion-visitantes" element={<VisitorInductionPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/recuperar-password" element={<ForgotPasswordPage />} />
            <Route path="/restablecer-password" element={<ResetPasswordPage />} />
            <Route path="/verificar-certificado" element={<VerifyCertificatePage />} />

            <Route
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route path="/portal" element={<DashboardPage />} />
              <Route path="/curso/:courseId" element={<CourseViewPage />} />
              <Route path="/curso/:courseId/evaluacion/:evaluationId" element={<EvaluationRunnerPage />} />
              <Route path="/certificados" element={<CertificatesPage />} />
              <Route path="/perfil" element={<ProfilePage />} />

              <Route
                path="/admin"
                element={
                  <RequirePermission permission="reports:view">
                    <AdminDashboardPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/usuarios"
                element={
                  <RequirePermission permission="users:view">
                    <AdminUsersPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/capacitaciones"
                element={
                  <RequirePermission permission="courses:view">
                    <AdminCoursesPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/capacitaciones/:courseId"
                element={
                  <RequirePermission permission="courses:edit">
                    <AdminCourseEditorPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/reportes"
                element={
                  <RequirePermission permission="reports:view">
                    <AdminReportsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/auditoria"
                element={
                  <RequirePermission permission="audit:view">
                    <AdminAuditPage />
                  </RequirePermission>
                }
              />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
