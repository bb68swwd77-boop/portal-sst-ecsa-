import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { AuthLayout } from "../components/AuthLayout";

export function VisitorInductionPage() {
  const { t } = useLanguage();

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-logo">
          <div className="mark">ECSA · Proyecto Mirador</div>
          <h2>{t("Inducción de Visitantes")}</h2>
        </div>

        <div className="empty-state mt-16">
          <h3>{t("Próximamente")}</h3>
          <p>{t("Estamos preparando el formulario de inducción para visitantes. Vuelva pronto.")}</p>
        </div>

        <div className="mt-16">
          <Link to="/" className="btn-link">
            ← {t("Volver al inicio")}
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
