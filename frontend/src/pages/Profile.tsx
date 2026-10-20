import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useToast } from "../context/ToastContext";
import { useLanguage } from "../context/LanguageContext";
import { PasswordInput } from "../components/PasswordInput";
import { PasswordRequirements, passwordMeetsRules } from "../components/PasswordRequirements";

interface Profile {
  email: string;
  code: string | null;
  firstName: string;
  lastName: string;
  documentId: string | null;
  company: string | null;
  area: string | null;
  position: string | null;
  category: string | null;
  lastLoginAt: string | null;
}

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const { notify } = useToast();
  const { t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [consents, setConsents] = useState<{ acceptances: { version: string; acceptedAt: string }[] } | null>(null);

  useEffect(() => {
    api.get<{ profile: Profile }>("/me/profile").then((res) => setProfile(res.profile));
    api
      .get<{ acceptances: { version: string; acceptedAt: string }[] }>("/me/consents")
      .then(setConsents)
      .catch(() => setConsents(null));
  }, []);

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/auth/password/change", { currentPassword, newPassword });
      notify(t("Contraseña actualizada correctamente."), "success");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("No fue posible cambiar la contraseña."));
    } finally {
      setSubmitting(false);
    }
  }

  if (!profile) return <div className="empty-state">{t("Cargando…")}</div>;

  return (
    <div>
      <h2 className="page-title">{t("Mi perfil")}</h2>

      <div className="card" style={{ maxWidth: 480 }}>
        <p style={{ fontSize: 14, lineHeight: 1.8 }}>
          <strong>
            {profile.firstName} {profile.lastName}
          </strong>
          <br />
          {profile.code ? `${t("Código de trabajador:")} ${profile.code}` : profile.email}
          <br />
          {profile.company && (
            <>
              {t("Empresa:")} {profile.company}
              <br />
            </>
          )}
          {profile.area && (
            <>
              {t("Área:")} {profile.area}
              <br />
            </>
          )}
          {profile.position && (
            <>
              {t("Cargo:")} {profile.position}
              <br />
            </>
          )}
          {profile.category && (
            <>
              {t("Categoría:")} {profile.category}
              <br />
            </>
          )}
          {profile.documentId && (
            <>
              {t("Identificación:")} {profile.documentId}
              <br />
            </>
          )}
          {profile.lastLoginAt && (
            <span className="text-muted">
              {t("Último acceso:")} {new Date(profile.lastLoginAt).toLocaleString("es-EC")}
            </span>
          )}
        </p>
      </div>

      <div className="card mt-24" style={{ maxWidth: 480 }}>
        <h3>{t("Cambiar contraseña")}</h3>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <form onSubmit={handlePasswordChange} noValidate>
          <div className="field">
            <label htmlFor="currentPassword">{t("Contraseña actual")}</label>
            <PasswordInput
              id="currentPassword"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="newPassword">{t("Nueva contraseña")}</label>
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              required
              minLength={10}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <PasswordRequirements value={newPassword} />
          </div>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={submitting || !currentPassword || !passwordMeetsRules(newPassword)}
          >
            {submitting ? t("Guardando…") : t("Actualizar contraseña")}
          </button>
        </form>
      </div>

      <div className="card mt-24" style={{ maxWidth: 480 }}>
        <h3>{t("Protección de datos y cookies")}</h3>
        {consents && consents.acceptances.length > 0 ? (
          <ul style={{ fontSize: 14, lineHeight: 1.8, marginLeft: 18 }}>
            {consents.acceptances.map((a) => (
              <li key={a.version}>
                {t("Políticas aceptadas el")} {new Date(a.acceptedAt).toLocaleString("es-EC")} ({t("versión")} {a.version})
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted" style={{ fontSize: 14 }}>
            {t("Aún no hay una aceptación registrada.")}
          </p>
        )}
        <Link to="/politicas" className="btn-link">
          {t("Leer las políticas")}
        </Link>
      </div>
    </div>
  );
}
