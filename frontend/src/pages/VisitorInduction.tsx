import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { AuthLayout } from "../components/AuthLayout";

const INDUCTION_FORM_URL = "https://forms.gle/VMn5v9z4s7ZQpV4A8";

export function VisitorInductionPage() {
  const { t } = useLanguage();

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-logo">
          <div className="mark">ECSA · Proyecto Mirador</div>
          <h2>{t("Inducción a Visitantes")}</h2>
        </div>

        <p className="page-subtitle mt-8">
          {t("Complete el formulario de inducción antes de ingresar a las instalaciones.")}
        </p>

        <div className="mt-24">
          <a
            href={INDUCTION_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ width: "100%", textAlign: "center" }}
          >
            {t("Iniciar formulario de inducción")} ↗
          </a>
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
