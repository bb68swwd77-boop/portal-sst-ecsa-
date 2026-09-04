import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useLanguage } from "../context/LanguageContext";
import { useIdleTimer } from "../hooks/useIdleTimer";

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

// Vigía global de inactividad: sin clics/teclas/scroll durante 10 minutos,
// cierra la sesión (si había una) y regresa a la pantalla de bienvenida.
export function IdleTimeoutWatcher() {
  const { user, logout } = useAuth();
  const { notify } = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const handleIdle = useCallback(async () => {
    if (location.pathname === "/") return;
    if (user) {
      try {
        await logout();
      } catch {
        // Si el logout falla igual queremos sacar al usuario de la pantalla.
      }
      notify(t("Sesión cerrada por inactividad."), "info");
    }
    navigate("/", { replace: true });
  }, [user, logout, notify, t, navigate, location.pathname]);

  useIdleTimer(IDLE_TIMEOUT_MS, handleIdle);

  return null;
}
