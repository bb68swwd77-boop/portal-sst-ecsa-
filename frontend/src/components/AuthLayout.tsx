import type { ReactNode } from "react";
import heroBanner from "../assets/hero-banner.png";
import { LanguageToggle } from "./LanguageToggle";

// El banner ya trae el logo, el mensaje y el mascote ECSA integrados a la
// imagen — el recuadro azul reservado en el diseño es donde se superpone la
// tarjeta de acceso (ver .auth-panel en theme.css).
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell" style={{ backgroundImage: `url(${heroBanner})` }}>
      <LanguageToggle className="auth-lang" />
      <div className="auth-panel">{children}</div>
    </div>
  );
}
