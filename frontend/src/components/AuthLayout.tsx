import type { ReactNode } from "react";
import coverMineria from "../assets/cover-mineria.jpg";
import { useLanguage } from "../context/LanguageContext";
import { LanguageToggle } from "./LanguageToggle";

export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="auth-shell">
      <div className="auth-hero" role="presentation">
        <img src={coverMineria} alt="" />
        <div className="auth-hero-caption">
          <span className="mark">ECSA · Proyecto Mirador</span>
          <h2>{t("Seguridad y Salud Ocupacional")}</h2>
          <p>{t("Módulos, evaluaciones y certificados verificables en un solo portal.")}</p>
        </div>
      </div>
      <div className="auth-panel">
        <LanguageToggle className="auth-lang" />
        {children}
      </div>
    </div>
  );
}
