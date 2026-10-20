import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { LanguageToggle } from "../components/LanguageToggle";
import { PolicyDocuments } from "../components/PolicyDocuments";
import { OnboardingSteps, markConsentShown } from "../components/OnboardingSteps";

// Pantalla obligatoria de primer ingreso (y de cada nueva versión de las
// políticas): se muestra en lugar de cualquier ruta protegida mientras
// user.policyAccepted sea false (ver RouteGuards.RequireAuth). El servidor
// además bloquea la API hasta que se registre la aceptación.
export function PolicyConsentPage() {
  const { user, logout, refresh } = useAuth();
  const { t } = useLanguage();
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Si además tiene clave temporal, después viene el cambio de contraseña.
  const totalSteps = user?.mustChangePassword ? 2 : 1;

  useEffect(() => {
    markConsentShown();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!checked) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/auth/policies/accept", { accepted: true });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("No fue posible registrar la aceptación."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="policy-gate">
      <LanguageToggle className="auth-lang" />
      <div className="policy-gate-card">
        <div className="auth-logo">
          <div className="mark">ECSA · Mina Mirador</div>
          <h2>{t("Protección de datos y uso de cookies")}</h2>
        </div>

        <OnboardingSteps current={1} total={totalSteps} />

        <p className="page-subtitle">
          {user ? `${user.firstName} ${user.lastName}. ` : ""}
          {t("Antes de continuar, lea y acepte las siguientes políticas. Solo se le pedirá una vez.")}
          {totalSteps > 1 && ` ${t("Después deberá crear su propia contraseña.")}`}
        </p>

        <PolicyDocuments scrollable />

        {error && <div className="alert alert-danger mt-16">{error}</div>}

        <form onSubmit={handleSubmit} noValidate className="mt-16">
          <label className="consent-check">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            <span>
              {t("He leído y acepto la Política de Protección de Datos Personales y la Política de Uso de Cookies.")}
            </span>
          </label>

          <div className="policy-actions">
            <button className="btn btn-primary" type="submit" disabled={!checked || submitting}>
              {submitting ? t("Registrando…") : t("Aceptar y continuar")}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => void logout()}>
              {t("No acepto, cerrar sesión")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
