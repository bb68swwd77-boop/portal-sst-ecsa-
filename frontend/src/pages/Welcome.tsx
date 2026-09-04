import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { AuthLayout } from "../components/AuthLayout";

export function WelcomePage() {
  const { t } = useLanguage();

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-logo">
          <div className="mark">ECSA · Proyecto Mirador</div>
          <h2>{t("Portal de Capacitación SST")}</h2>
        </div>

        <p className="page-subtitle mt-8">{t("Seleccione una opción para continuar.")}</p>

        <div className="mt-24" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Link to="/login" className="btn btn-primary" style={{ width: "100%", textAlign: "center" }}>
            {t("Portal de Capacitaciones")}
          </Link>
          <Link to="/induccion-visitantes" className="btn btn-secondary" style={{ width: "100%", textAlign: "center" }}>
            {t("Inducción de Visitantes")}
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
