import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import { useToast } from "../context/ToastContext";

interface LockedUser {
  id: string;
  code: string | null;
  firstName: string;
  lastName: string;
  company: string | null;
  lockedUntil: string;
}

const REFRESH_MS = 30_000;

// Aviso para administradores: aparece en cuanto inician sesión (y se mantiene al
// día) cuando hay cuentas bloqueadas por 3 intentos fallidos, con el botón para
// reactivarlas sin esperar los 15 minutos del bloqueo temporal.
export function LockedAccountsAlert() {
  const { t } = useLanguage();
  const { notify } = useToast();
  const [users, setUsers] = useState<LockedUser[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ users: LockedUser[] }>("/admin/users/locked");
      setUsers(res.users);
    } catch {
      // Es un aviso accesorio: si falla una consulta, se reintenta en el siguiente ciclo.
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  async function unlock(id: string) {
    setBusyId(id);
    try {
      await api.post(`/admin/users/${id}/unlock`);
      notify(t("Cuenta desbloqueada."), "success");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (users.length === 0) return null;

  return (
    <div className="alert alert-danger locked-alert" role="alert">
      <strong>
        {users.length === 1
          ? t("Hay 1 cuenta bloqueada por intentos fallidos de ingreso")
          : `${t("Cuentas bloqueadas por intentos fallidos de ingreso:")} ${users.length}`}
      </strong>
      <ul className="locked-alert-list">
        {users.map((u) => (
          <li key={u.id}>
            <span>
              {u.firstName} {u.lastName} · {u.code ?? "—"}
              {u.company ? ` · ${u.company}` : ""}{" "}
              <span className="text-muted">
                ({t("se desbloquea sola a las")}{" "}
                {new Date(u.lockedUntil).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })})
              </span>
            </span>
            <button className="btn btn-secondary btn-sm" disabled={busyId === u.id} onClick={() => unlock(u.id)}>
              {t("Activar cuenta")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
