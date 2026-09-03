import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { translations } from "../i18n/translations";

export type Lang = "es" | "zh";

const STORAGE_KEY = "ecsa-lang";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (text: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function readInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "es" || stored === "zh") return stored;
  } catch {
    // localStorage puede no estar disponible; se usa el valor por defecto.
  }
  return "es";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // no crítico
    }
  }, [lang]);

  function setLang(next: Lang) {
    setLangState(next);
  }

  function toggleLang() {
    setLangState((prev) => (prev === "es" ? "zh" : "es"));
  }

  // Diccionario indexado por el texto en español: si no hay traducción
  // registrada, se devuelve el texto original en vez de romper la UI.
  function t(text: string): string {
    if (lang === "es") return text;
    return translations[text] ?? text;
  }

  return <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage debe usarse dentro de LanguageProvider");
  return ctx;
}
