import { useDashboardLink } from "../hooks/useDashboardLink";
import { useLanguage } from "../context/LanguageContext";

// Marca de Power BI (tres barras amarillas), dibujada en SVG para no depender de
// un archivo externo. Si se prefiere el logo oficial, basta cambiar este componente.
function PowerBiLogo() {
  return (
    <svg viewBox="0 0 64 64" width="84" height="84" aria-hidden="true">
      <defs>
        <linearGradient id="pbi-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE066" />
          <stop offset="1" stopColor="#F2C811" />
        </linearGradient>
        <linearGradient id="pbi-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F2C811" />
          <stop offset="1" stopColor="#E3A008" />
        </linearGradient>
      </defs>
      <rect x="7" y="34" width="14" height="22" rx="4" fill="url(#pbi-b)" />
      <rect x="25" y="20" width="14" height="36" rx="4" fill="url(#pbi-a)" />
      <rect x="43" y="6" width="14" height="50" rx="4" fill="#F2C811" />
    </svg>
  );
}

// Tarjeta de la pantalla principal que lleva al dashboard de Power BI. Solo se
// muestra a las personas autorizadas por un administrador; Power BI exige además
// su propio inicio de sesión de la organización y licencia.
export function PowerBiCard() {
  const url = useDashboardLink();
  const { t } = useLanguage();
  if (!url) return null;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="card course-card powerbi-card">
      <div className="course-thumb powerbi-thumb">
        <PowerBiLogo />
        <span className="powerbi-wordmark">Power BI</span>
      </div>
      <div className="course-card-body">
        <span className="badge badge-copper" style={{ alignSelf: "flex-start" }}>
          {t("Indicadores")}
        </span>
        <div className="course-title">{t("Dashboard Power BI")}</div>
        <div className="course-desc">{t("Indicadores y avance de las capacitaciones de seguridad y salud en el trabajo.")}</div>
        <span className="btn btn-primary mt-8">{t("Abrir dashboard")} ↗</span>
      </div>
    </a>
  );
}
