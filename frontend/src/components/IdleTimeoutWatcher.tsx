import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useLanguage } from "../context/LanguageContext";
import { ACTIVITY_EVENT, useIdleTimer } from "../hooks/useIdleTimer";
import { Modal } from "./Modal";

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const WARNING_SECONDS = 60;

// Vigía global de inactividad: sin clics/teclas/scroll durante 10 minutos,
// cierra la sesión (si había una) y regresa a la pantalla de bienvenida.
// Un minuto antes avisa con una cuenta regresiva para que quien sigue ahí
// pueda continuar. Un video en reproducción cuenta como actividad (ver
// YouTubePlayer, que dispara ACTIVITY_EVENT).
export function IdleTimeoutWatcher() {
  const { user, logout } = useAuth();
  const { notify } = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WARNING_SECONDS);

  const handleIdle = useCallback(async () => {
    setShowWarning(false);
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

  useIdleTimer(IDLE_TIMEOUT_MS, handleIdle, {
    warnBeforeMs: WARNING_SECONDS * 1000,
    // Solo tiene sentido avisar a quien tiene una sesión abierta.
    onWarn: () => {
      if (!user) return;
      setSecondsLeft(WARNING_SECONDS);
      setShowWarning(true);
    },
    onActive: () => setShowWarning(false),
  });

  useEffect(() => {
    if (!showWarning) return;
    const interval = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(interval);
  }, [showWarning]);

  // "Seguir conectado": una actividad simulada reinicia el temporizador y oculta el aviso.
  const stayConnected = () => window.dispatchEvent(new Event(ACTIVITY_EVENT));

  if (!showWarning) return null;

  return (
    <Modal title={t("¿Sigue ahí?")} onClose={stayConnected}>
      <p>
        {t("Por seguridad, su sesión se cerrará por inactividad en")}{" "}
        <strong>
          {secondsLeft} {t("segundos")}
        </strong>
        .
      </p>
      <p className="text-muted" style={{ fontSize: 14 }}>
        {t("Si está respondiendo una evaluación, sus respuestas se guardan automáticamente.")}
      </p>
      <button className="btn btn-primary" onClick={stayConnected}>
        {t("Seguir conectado")}
      </button>
    </Modal>
  );
}
