import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import te from "./locales/te.json";
import hi from "./locales/hi.json";

function detectDeviceLanguage(): string {
  const saved = localStorage.getItem("i18nextLng");
  if (saved === "en" || saved === "hi" || saved === "te") {
    return saved;
  }
  const langs = typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : [];
  for (const lang of langs) {
    const code = (lang || "").toLowerCase();
    if (code.startsWith("te")) return "te";
    if (code.startsWith("hi")) return "hi";
  }
  return "en";
}

const savedLanguage = detectDeviceLanguage();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    te: { translation: te },
    hi: { translation: hi },
  },
  lng: savedLanguage,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
