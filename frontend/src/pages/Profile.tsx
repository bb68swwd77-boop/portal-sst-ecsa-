import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import { useToast } from "../context/ToastContext";

interface Profile {
  email: string;
  firstName: string;
  lastName: string;
  documentId: string | null;
  company: string | null;
  area: string | null;
  position: string | null;
  lastLoginAt: string | null;
}

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const { notify } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<{ profile: Profile }>("/me/profile").then((res) => setProfile(res.profile));
  }, []);

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/auth/password/change", { currentPassword, newPassword });
      notify("Contraseña actualizada correctamente.", "success");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No fue posible cambiar la contraseña.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!profile) return <div className="empty-state">Cargando…</div>;

  return (
    <div>
      <h2 className="page-title">Mi perfil</h2>

      <div className="card" style={{ maxWidth: 480 }}>
        <p style={{ fontSize: 14, lineHeight: 1.8 }}>
          <strong>
            {profile.firstName} {profile.lastName}
          </strong>
          <br />
          {profile.email}
          <br />
          {profile.company && (
            <>
              Empresa: {profile.company}
              <br />
            </>
          )}
          {profile.area && (
            <>
              Área: {profile.area}
              <br />
            </>
          )}
          {profile.position && (
            <>
              Cargo: {profile.position}
              <br />
            </>
          )}
          {profile.documentId && (
            <>
              Identificación: {profile.documentId}
              <br />
            </>
          )}
          {profile.lastLoginAt && <span className="text-muted">Último acceso: {new Date(profile.lastLoginAt).toLocaleString("es-EC")}</span>}
        </p>
      </div>

      <div className="card mt-24" style={{ maxWidth: 480 }}>
        <h3>Cambiar contraseña</h3>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handlePasswordChange} noValidate>
          <div className="field">
            <label htmlFor="currentPassword">Contraseña actual</label>
            <input
              id="currentPassword"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="newPassword">Nueva contraseña</label>
            <input
              id="newPassword"
              type="password"
              required
              minLength={10}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Guardando…" : "Actualizar contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}
