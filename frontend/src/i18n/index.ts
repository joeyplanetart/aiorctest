import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import zh from "./zh.json";

export const LANG_STORAGE_KEY = "app_language";

export function getStoredLanguage(): "en" | "zh" {
  try {
    const v = localStorage.getItem(LANG_STORAGE_KEY);
    if (v === "zh" || v === "en") return v;
  } catch {
    /* ignore */
  }
  return "en";
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: getStoredLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

document.documentElement.lang = getStoredLanguage() === "zh" ? "zh-CN" : "en";

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng.startsWith("zh") ? "zh-CN" : "en";
});

export function setAppLanguage(lng: "en" | "zh") {
  void i18n.changeLanguage(lng);
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lng);
  } catch {
    /* ignore */
  }
}

export default i18n;
