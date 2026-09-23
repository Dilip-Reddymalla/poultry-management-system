import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "en", label: "EN", title: "English" },
  { code: "te", label: "తె", title: "తెలుగు (Telugu)" },
  { code: "hi", label: "हि", title: "हिंदी (Hindi)" },
] as const;

export function LanguageSwitcher(): React.ReactElement {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.slice(0, 2) || "en";

  const handleSelect = (code: string): void => {
    i18n.changeLanguage(code);
    try {
      localStorage.setItem("i18nextLng", code);
    } catch {
      // ignore storage error if any
    }
  };

  return (
    <div className="lang-switcher" role="group" aria-label="Select language">
      {LANGUAGES.map(({ code, label, title }) => {
        const isActive = currentLang === code;
        return (
          <button
            key={code}
            type="button"
            className={`lang-switcher__btn ${isActive ? "lang-switcher__btn--active" : ""}`}
            onClick={() => handleSelect(code)}
            title={title}
            aria-pressed={isActive}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
