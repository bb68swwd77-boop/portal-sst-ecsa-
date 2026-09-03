import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  if (loading) return <div className="empty-state">{t("Cargando…")}</div>;
  if (!user) return <Navigate to="/login" replace />;
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
