import { useTranslation } from 'react-i18next';
import { getLanguages, changeLanguage } from '../i18n/config';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const languages = getLanguages();

  return (
    <span className="seg" aria-label={t('common.language')}>
      {languages.map((lang) => (
        <label key={lang.code} className="seg-opt" style={{ padding: '5px 8px', fontSize: 11 }}>
          <input
            type="radio"
            name="lang"
            checked={i18n.language === lang.code}
            onChange={() => changeLanguage(lang.code)}
          />
          {lang.code.toUpperCase()}
        </label>
      ))}
    </span>
  );
}
