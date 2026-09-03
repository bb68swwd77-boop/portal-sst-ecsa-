import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { AuthLayout } from "../components/AuthLayout";
import { useLanguage } from "../context/LanguageContext";

export function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoLink, setDemoLink] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const res = await api.post<{ message: string; demoToken?: string }>("/auth/password/forgot", { email });
      setMessage(res.message);
      if (res.demoToken) {
        setDemoLink(`/restablecer-password?token=${encodeURIComponent(res.demoToken)}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("No fue posible procesar la solicitud."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-logo">
          <div className="mark">ECSA · Proyecto Mirador</div>
          <h2>{t("Recuperar contraseña")}</h2>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {message && <div className="alert alert-success">{t(message)}</div>}
        {demoLink && (
          <div className="alert alert-info">
            {t("Modo DEMO (sin correo configurado):")} <Link to={demoLink}>{t("continuar el restablecimiento aquí")}</Link>.
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="email">{t("Correo electrónico")}</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "100%" }}>
            {submitting ? t("Enviando…") : t("Enviar instrucciones")}
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
