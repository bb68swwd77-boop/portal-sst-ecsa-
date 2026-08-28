import type { ReactNode } from "react";
import coverMineria from "../assets/cover-mineria.jpg";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-hero" role="presentation">
        <img src={coverMineria} alt="" />
        <div className="auth-hero-caption">
          <span className="mark">ECSA · Proyecto Mirador</span>
          <h2>Capacitación SST para contratistas</h2>
          <p>Módulos, evaluaciones y certificados verificables en un solo portal.</p>
        </div>
      </div>
      <div className="auth-panel">{children}</div>
    </div>
  );
}
