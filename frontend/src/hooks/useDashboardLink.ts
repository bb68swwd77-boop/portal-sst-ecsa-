import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

// Enlace al dashboard de Power BI para el usuario en sesión. El servidor solo lo
// entrega a quien un administrador autorizó; para el resto (o si aún no hay enlace
// configurado) devuelve null y ni el menú ni la tarjeta se muestran.
export function useDashboardLink(): string | null {
  const { user } = useAuth();
  const allowed = Boolean(user?.canViewDashboard);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed) {
      setUrl(null);
      return;
    }
    api
      .get<{ url: string | null }>("/dashboard-link")
      .then((res) => setUrl(res.url))
      .catch(() => setUrl(null));
  }, [allowed]);

  return url;
}
