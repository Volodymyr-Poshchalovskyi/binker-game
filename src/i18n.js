import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      welcome: "Welcome",
      description: "This is a Vite + React + Tailwind template"
    }
  },
  ua: {
    translation: {
      welcome: "Ласкаво просимо",
      description: "Це шаблон Vite + React + Tailwind"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // мова за замовчуванням
    fallbackLng: 'en',
    interpolation: { escapeValue: false }
  });

export default i18n;
