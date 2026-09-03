import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { AuthLayout } from "../components/AuthLayout";
import { useLanguage } from "../context/LanguageContext";

export function ResetPasswordPage() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError(t("Las contraseñas no coinciden."));
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/password/reset", { token, newPassword });
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("No fue posible restablecer la contraseña."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-logo">
          <div className="mark">ECSA · Proyecto Mirador</div>
          <h2>{t("Restablecer contraseña")}</h2>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="token">{t("Código de restablecimiento")}</label>
            <input id="token" required value={token} onChange={(e) => setToken(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="newPassword">{t("Nueva contraseña")}</label>
            <input
              id="newPassword"
              type="password"
              required
              minLength={10}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <div className="field-hint">{t("Mínimo 10 caracteres, con mayúscula, minúscula y número.")}</div>
          </div>
          <div className="field">
            <label htmlFor="confirm">{t("Confirmar contraseña")}</label>
            <input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "100%" }}>
            {submitting ? t("Guardando…") : t("Restablecer contraseña")}
          </button>
        </form>

        <div className="mt-16 text-center">
          <Link to="/login" className="btn-link">
            {t("Volver a iniciar sesión")}
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
