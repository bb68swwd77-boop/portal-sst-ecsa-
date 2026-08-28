import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="empty-state">Cargando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { hasPermission, loading } = useAuth();
  if (loading) return <div className="empty-state">Cargando…</div>;
  if (!hasPermission(permission)) {
    return (
      <div className="empty-state">
        <h3>Acceso restringido</h3>
        <p>No tiene permisos para ver esta sección.</p>
      </div>
    );
  }
  return <>{children}</>;
}
