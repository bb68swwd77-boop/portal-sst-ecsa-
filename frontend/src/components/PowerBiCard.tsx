import { useDashboardLink } from "../hooks/useDashboardLink";
import { useLanguage } from "../context/LanguageContext";

// Marca de Power BI (tres barras amarillas), dibujada en SVG para no depender de
// un archivo externo. Si se prefiere el logo oficial, basta cambiar este componente.
function PowerBiLogo({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
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

// Tarjeta compacta para la fila de indicadores de la pantalla principal (junto a
// "Certificados"), así no se confunde con una capacitación asignada. Solo se
// muestra a las personas autorizadas por un administrador; Power BI exige además
// su propio inicio de sesión de la organización y licencia.
export function PowerBiCard() {
  const url = useDashboardLink();
  const { t } = useLanguage();
  if (!url) return null;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="stat-card powerbi-stat">
      <PowerBiLogo size={44} />
      <span className="powerbi-stat-text">
        <span className="powerbi-stat-title">{t("Dashboard Power BI")}</span>
        <span className="powerbi-stat-open">{t("Abrir dashboard")} ↗</span>
      </span>
    </a>
  );
}
