import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { ApiError } from "../api/client";
import { AuthLayout } from "../components/AuthLayout";

export function LoginPage() {
  const { login, user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    navigate("/portal", { replace: true });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/portal", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("No fue posible iniciar sesión."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-card">
        <Link to="/" className="btn-link">
          ← {t("Volver al inicio")}
        </Link>
        <div className="auth-logo mt-8">
          <div className="mark">ECSA · Proyecto Mirador</div>
          <h2>{t("Portal de Capacitación SST")}</h2>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="email">{t("Correo electrónico")}</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">{t("Contraseña")}</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "100%" }}>
            {submitting ? t("Ingresando…") : t("Iniciar sesión")}
          </button>
        </form>

        <div className="flex-between mt-16">
          <Link to="/recuperar-password" className="btn-link">
            {t("¿Olvidó su contraseña?")}
          </Link>
          <Link to="/verificar-certificado" className="btn-link">
            {t("Verificar certificado")}
          </Link>
        </div>

        <p className="field-hint mt-16">
          {t("Acceso DEMO: admin@example.com / usuario1@example.com — contraseña Demo#2026Sst")}
        </p>
      </div>
    </AuthLayout>
  );
}
