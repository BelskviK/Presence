import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from './en.json';
import heTranslations from './he.json';
import ruTranslations from './ru.json';
import kaTranslations from './ka.json';

const resources = {
  en: { translation: enTranslations },
  he: { translation: heTranslations },
  ru: { translation: ruTranslations },
  ka: { translation: kaTranslations },
};

const RTL_LANGUAGES = ['he', 'ar'];

const getSavedLanguage = () => {
  return localStorage.getItem('language') || 'en';
};

const setSavedLanguage = (lang) => {
  localStorage.setItem('language', lang);
};

const applyLanguageDirection = (lang) => {
  const isRTL = RTL_LANGUAGES.includes(lang);
  const htmlElement = document.documentElement;
  htmlElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
  htmlElement.lang = lang;
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getSavedLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    ns: ['translation'],
    defaultNS: 'translation',
  });

// Apply initial language direction
applyLanguageDirection(i18n.language);

// Watch for language changes
i18n.on('languageChanged', (lang) => {
  applyLanguageDirection(lang);
  setSavedLanguage(lang);
});

export const changeLanguage = (lang) => {
  i18n.changeLanguage(lang);
};

export const getLanguages = () => [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'ka', name: 'Georgian', nativeName: 'ქართული' },
];

export const isRTL = () => RTL_LANGUAGES.includes(i18n.language);

export default i18n;
