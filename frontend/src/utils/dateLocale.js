import { enUS, he, ru, ka } from 'date-fns/locale';
import i18n from '../i18n/config';

const LOCALES = { en: enUS, he, ru, ka };

// date-fns needs an explicit locale object; without it month names, weekday
// abbreviations and relative phrases ("4 minutes ago") stay English no matter
// what the UI language is.
export const dateLocale = () => LOCALES[i18n.language] || enUS;

// Convenience wrapper so callers don't have to remember the option key.
export const withLocale = (options = {}) => ({ ...options, locale: dateLocale() });
