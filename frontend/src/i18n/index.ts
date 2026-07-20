import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"

import en from "./locales/en.json"
import tw from "./locales/tw.json"
import fr from "./locales/fr.json"

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "tw", label: "Twi" },
  { code: "fr", label: "Français" },
] as const

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      tw: { translation: tw },
      fr: { translation: fr },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "tw", "fr"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "deevalegh.lang",
      caches: ["localStorage"],
    },
  })

// Keep <html lang> in sync globally (every page, not just authed layouts) so
// screen readers and hyphenation always match the active language.
function syncHtmlLang(lng: string) {
  document.documentElement.lang = (lng || "en").split("-")[0]
}
syncHtmlLang(i18n.language)
i18n.on("languageChanged", syncHtmlLang)

export default i18n
