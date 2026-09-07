import { useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { AuthLayout } from "../components/AuthLayout";

// Pantalla obligatoria de primer acceso: se muestra en lugar de cualquier
// otra ruta protegida mientras user.mustChangePassword sea true (ver
// RouteGuards.RequireAuth). Reutiliza el mismo endpoint que "Mi perfil".
export function ForceChangePasswordPage() {
  const { logout, refresh } = useAuth();
  const { t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/auth/password/change", { currentPassword, newPassword });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("No fue posible cambiar la contraseña."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-logo">
          <div className="mark">ECSA · Mina Mirador</div>
          <h2>{t("Cree su nueva contraseña")}</h2>
        </div>

        <p className="page-subtitle mt-8">
          {t("Por seguridad, debe cambiar la contraseña temporal antes de continuar.")}
        </p>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="currentPassword">{t("Contraseña temporal")}</label>
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="newPassword">{t("Nueva contraseña")}</label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <div className="field-hint">{t("Mínimo 10 caracteres, con mayúscula, minúscula y número.")}</div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "100%" }}>
            {submitting ? t("Guardando…") : t("Guardar y continuar")}
          </button>
        </form>

        <button className="btn-link mt-16" onClick={() => logout()}>
          {t("Cerrar sesión")}
        </button>
      </div>
    </AuthLayout>
  );
}
