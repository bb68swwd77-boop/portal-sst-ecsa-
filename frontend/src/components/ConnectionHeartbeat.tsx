import { useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;

// Avisa al servidor cada 2 min mientras hay sesión y la pestaña está visible;
// el servidor suma ese tiempo al total de conexión del usuario (reportes).
export function ConnectionHeartbeat() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    function beat() {
      if (document.visibilityState !== "visible") return;
      api.post("/me/heartbeat").catch(() => {
        // Un heartbeat fallido solo resta precisión al reporte; no debe molestar al usuario.
      });
    }

    beat();
    const timer = window.setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [user?.id]);

  return null;
}
