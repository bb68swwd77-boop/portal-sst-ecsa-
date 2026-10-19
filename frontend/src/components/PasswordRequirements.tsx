import { useLanguage } from "../context/LanguageContext";

// Mismas reglas que valida el servidor (backend/src/validators/auth.ts).
const RULES = [
  { label: "Al menos 10 caracteres", test: (v: string) => v.length >= 10 },
  { label: "Una letra minúscula", test: (v: string) => /[a-z]/.test(v) },
  { label: "Una letra mayúscula", test: (v: string) => /[A-Z]/.test(v) },
  { label: "Un número", test: (v: string) => /[0-9]/.test(v) },
];

export function passwordMeetsRules(value: string) {
  return RULES.every((r) => r.test(value));
}

// Lista en vivo de requisitos de la contraseña nueva: cada uno se marca al cumplirse.
export function PasswordRequirements({ value }: { value: string }) {
  const { t } = useLanguage();
  return (
    <ul className="pw-rules" aria-live="polite">
      {RULES.map((r) => {
        const ok = r.test(value);
        return (
          <li key={r.label} className={ok ? "ok" : undefined}>
            <span aria-hidden="true">{ok ? "✓" : "○"}</span> {t(r.label)}
          </li>
        );
      })}
    </ul>
  );
}
