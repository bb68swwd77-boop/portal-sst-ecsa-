import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { AuthLayout } from "../components/AuthLayout";
import { useLanguage } from "../context/LanguageContext";

// Los trabajadores ingresan con su código y no tienen un correo real asociado,
// así que esta pantalla registra la solicitud por código: el administrador la
// ve en Usuarios y les entrega una clave temporal (que deben cambiar al entrar).
export function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [identifier, setIdentifier] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoLink, setDemoLink] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setDemoLink(null);
    setSubmitting(true);
    try {
      const res = await api.post<{ message: string; demoToken?: string }>("/auth/password/forgot", { identifier });
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
          <div className="mark">ECSA · Mina Mirador</div>
          <h2>{t("Recuperar contraseña")}</h2>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {message && <div className="alert alert-success">{t(message)}</div>}
        {demoLink && (
          <div className="alert alert-info">
            {t("Modo DEMO (sin correo configurado):")} <Link to={demoLink}>{t("continuar el restablecimiento aquí")}</Link>.
          </div>
        )}

        {!message && (
          <>
            <p className="page-subtitle">
              {t("Escriba su código de trabajador. El administrador del portal recibirá su solicitud y le entregará una clave temporal.")}
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label htmlFor="identifier">{t("Código de trabajador")}</label>
                <input
                  id="identifier"
                  type="text"
                  inputMode="text"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={submitting || !identifier.trim()} style={{ width: "100%" }}>
                {submitting ? t("Enviando…") : t("Solicitar clave temporal")}
              </button>
            </form>
          </>
        )}

        {message && (
          <p className="text-muted" style={{ fontSize: 14 }}>
            {t("Con la clave temporal podrá ingresar y se le pedirá crear una contraseña nueva.")}
          </p>
        )}

        <div className="mt-16 text-center">
          <Link to="/login" className="btn-link">
            {t("Volver a iniciar sesión")}
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
