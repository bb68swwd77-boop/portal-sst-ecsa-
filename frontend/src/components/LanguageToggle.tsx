import { useLanguage } from "../context/LanguageContext";

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLanguage();

  return (
    <div className={`lang-toggle ${className ?? ""}`} role="group" aria-label="Idioma / 语言">
      <button type="button" className={lang === "es" ? "active" : ""} aria-pressed={lang === "es"} onClick={() => setLang("es")}>
        ES
      </button>
      <button type="button" lang="zh-CN" className={lang === "zh" ? "active" : ""} aria-pressed={lang === "zh"} onClick={() => setLang("zh")}>
        中文
      </button>
    </div>
  );
}
