import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import { useToast } from "../context/ToastContext";
import { useLanguage } from "../context/LanguageContext";

// Tarjeta para que el administrador pegue o cambie el enlace del dashboard de
// Power BI. Quién ve el botón se decide por persona al editar cada usuario.
export function DashboardLinkSettings() {
  const { t } = useLanguage();
  const { notify } = useToast();
  const [saved, setSaved] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ url: string | null }>("/admin/dashboard-link")
      .then((res) => {
        setSaved(res.url);
        setValue(res.url ?? "");
      })
      .catch(() => setError(t("No fue posible cargar el enlace del dashboard.")))
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await api.put<{ url: string | null }>("/admin/dashboard-link", { url: value });
      setSaved(res.url);
      setValue(res.url ?? "");
      notify(res.url ? t("Enlace del dashboard guardado.") : t("Enlace del dashboard quitado."), "success");
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("No fue posible guardar el enlace."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card mt-16">
      <h3>{t("Dashboard Power BI")}</h3>
      <p className="text-muted" style={{ fontSize: 14 }}>
        {t("Pegue el enlace del reporte o de la app de Power BI. Aparece como botón en el menú solo a las personas que usted autorice (Editar usuario → Puede ver el dashboard).")}
      </p>
      <form onSubmit={handleSave} noValidate>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <div className="field">
          <label>{t("Enlace del dashboard")}</label>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://app.powerbi.com/…"
            inputMode="url"
            disabled={!loaded}
          />
          <div className="field-hint">
            {t("Use el enlace de \"Compartir\". No use \"Publicar en la web\": es público. Quien entre necesita su cuenta de la organización y licencia de Power BI.")}
          </div>
        </div>
        <div className="flex gap-8" style={{ flexWrap: "wrap" }}>
          <button className="btn btn-primary btn-sm" type="submit" disabled={saving || !loaded}>
            {saving ? t("Guardando…") : t("Guardar enlace")}
          </button>
          {saved && (
            <a className="btn btn-secondary btn-sm" href={saved} target="_blank" rel="noopener noreferrer">
              {t("Probar enlace")} ↗
            </a>
          )}
        </div>
      </form>
    </div>
  );
}
