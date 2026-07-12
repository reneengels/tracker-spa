import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";

const languageDetector = new LanguageDetector();

// Override the detect function to normalize saved language to language-only code
languageDetector.detect = () => {
  const lang = localStorage.getItem('i18nextLng') || navigator.language || 'en';

  // Normalize to language only, e.g. 'de-DE' => 'de'
  return lang.split('-')[0];
};

i18next.use(languageDetector).use(initReactI18next).use(Backend).init({
    supportedLngs: ['en', 'de'],
    returnObjects: true,
    load: 'languageOnly',
    fallbackLng: "en",
    debug: true,
});