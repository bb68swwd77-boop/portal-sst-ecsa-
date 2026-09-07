import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { ForceChangePasswordPage } from "../pages/ForceChangePassword";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  if (loading) return <div className="empty-state">{t("Cargando…")}</div>;
  if (!user) return <Navigate to="/login" replace />;
  // Bloquea el acceso a cualquier ruta protegida hasta que cambie la
  // contraseña temporal — sin excepción de ruta, para que no pueda
  // navegar a otra sección desde el menú antes de hacerlo.
  if (user.mustChangePassword) return <ForceChangePasswordPage />;
  return <>{children}</>;
}

export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { hasPermission, loading } = useAuth();
  const { t } = useLanguage();
  if (loading) return <div className="empty-state">{t("Cargando…")}</div>;
  if (!hasPermission(permission)) {
    return (
      <div className="empty-state">
        <h3>{t("Acceso restringido")}</h3>
        <p>{t("No tiene permisos para ver esta sección.")}</p>
      </div>
    );
  }
  return <>{children}</>;
}
