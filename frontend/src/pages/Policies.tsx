import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { LanguageToggle } from "../components/LanguageToggle";
import { PolicyDocuments } from "../components/PolicyDocuments";

// Página pública: permite leer las políticas sin iniciar sesión (enlazada
// desde la pantalla de acceso) y volver a consultarlas en cualquier momento.
export function PoliciesPage() {
  const { t } = useLanguage();

  return (
    <div className="policy-gate">
      <LanguageToggle className="auth-lang" />
      <div className="policy-gate-card">
        <Link to="/login" className="btn-link">
          ← {t("Volver al acceso")}
        </Link>
        <div className="auth-logo mt-8">
          <div className="mark">ECSA · Mina Mirador</div>
          <h2>{t("Protección de datos y uso de cookies")}</h2>
        </div>
        <PolicyDocuments />
      </div>
    </div>
  );
}
