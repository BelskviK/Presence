import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import { getLanguages, changeLanguage } from '../i18n/config';
import Icon from '../components/Icon';

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      toast.success(t('auth.loginSuccess'));
      navigate('/');
    } catch (err) {
      toast.error(err?.response?.data?.message || t('auth.loginFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid md:grid-cols-[1.05fr_1fr] min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div
        className="relative hidden md:flex flex-col justify-between p-10"
        style={{ background: 'var(--color-accent-900)', color: 'var(--color-bg)' }}
      >
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 19, letterSpacing: '.16em', textTransform: 'uppercase' }}>
          Attenda
        </div>
        <div
          className="absolute grid place-items-center"
          style={{
            inset: 40, top: 96, bottom: 132, borderRadius: 18,
            border: '1px solid rgba(242,242,243,.28)',
            backgroundImage: 'repeating-linear-gradient(135deg, rgba(242,242,243,.13) 0 1px, transparent 1px 8px)',
          }}
        >
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '.1em', color: 'rgba(242,242,243,.65)' }}>
            [ {t('auth.sitePhotoPlaceholder')} ]
          </span>
        </div>
        <div style={{ maxWidth: 380 }}>
          <h2 style={{ fontSize: 34, color: 'var(--color-bg)', marginBottom: 8 }}>{t('auth.loginTagline')}</h2>
          <p style={{ fontSize: 14, color: 'rgba(242,242,243,.7)', margin: 0 }}>{t('auth.loginSubtagline')}</p>
        </div>
      </div>

      <div className="grid place-items-center p-8">
        <div style={{ width: '100%', maxWidth: 340 }}>
          <h6 style={{ color: 'var(--color-accent)' }}>{t('auth.signIn')}</h6>
          <h2 style={{ fontSize: 30, marginBottom: 22 }}>{t('common.welcomeBack')}</h2>
          <form onSubmit={handleSubmit}>
            <div className="field" style={{ marginBottom: 14 }}>
              <label>{t('auth.email')}</label>
              <input type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="field" style={{ marginBottom: 20 }}>
              <label>{t('auth.password')}</label>
              <input type="password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <button type="submit" disabled={busy} className="btn btn-primary btn-block blueprint" style={{ height: 42 }}>
              <Icon name="log-in" className="w-4 h-4" />
              {busy ? t('common.loading') : t('auth.login')}
            </button>
          </form>
          <div className="flex items-center gap-1.5 mt-7">
            <Icon name="globe" className="w-4 h-4" style={{ color: 'var(--color-neutral-600)' }} />
            {getLanguages().map((lang) => (
              <button
                key={lang.code}
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: '2px 6px', fontWeight: i18n.language === lang.code ? 700 : 400 }}
                onClick={() => changeLanguage(lang.code)}
              >
                {lang.code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
