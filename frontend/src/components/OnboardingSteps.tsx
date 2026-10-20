import { useLanguage } from "../context/LanguageContext";

// El primer ingreso pasa por pantallas obligatorias en orden: aceptar las
// políticas y, si la clave es temporal, crear una propia. Este indicador le dice
// al trabajador en qué paso va y cuántos faltan, para que no sienta que el portal
// lo "bloquea" sin motivo.
//
// La pantalla de políticas anota aquí que se mostró, para que la de cambio de
// clave sepa que es el paso 2 de 2 (al aceptar, el usuario ya figura como
// "aceptado" y esa pista se perdería).
let consentShownThisVisit = false;

export function markConsentShown() {
  consentShownThisVisit = true;
}

export function wasConsentShown() {
  return consentShownThisVisit;
}

export function OnboardingSteps({ current, total }: { current: number; total: number }) {
  const { lang } = useLanguage();
  if (total < 2) return null;
  // "de" del diccionario significa "página X de Y" en chino; aquí se arma la frase completa.
  const label = lang === "zh" ? `第 ${current} 步，共 ${total} 步` : `Paso ${current} de ${total}`;

  return (
    <div className="onboarding-steps" role="group" aria-label={label}>
      <div className="onboarding-dots" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={i + 1 < current ? "done" : i + 1 === current ? "active" : undefined} />
        ))}
      </div>
      <strong>{label}</strong>
    </div>
  );
}
