import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import Icon from '../Icon';

// The "things an employer should actually act on" panel. Each row links to
// wherever the problem gets fixed, and the card stays quiet when all is well.
export default function NeedsAttentionCard({ exceptions, pendingLeave = 0, className = '' }) {
  const { t } = useTranslation();
  if (!exceptions) return null;

  const { missingClockouts = 0, staleOpenShifts = [], noOffice = [], neverLoggedIn = 0 } = exceptions;

  const items = [
    missingClockouts > 0 && {
      key: 'missing',
      icon: 'clock',
      count: missingClockouts,
      label: t('attendance.missingClockout'),
      detail: t('dashboard.missingClockoutHint'),
      to: '/attendance',
    },
    staleOpenShifts.length > 0 && {
      key: 'stale',
      icon: 'repeat',
      count: staleOpenShifts.length,
      label: t('dashboard.staleOpenShifts'),
      detail: staleOpenShifts
        .slice(0, 2)
        .map((s) => `${s.firstName} ${s.lastName} · ${format(new Date(s.date), 'MMM d')}`)
        .join(', '),
      to: '/attendance',
    },
    noOffice.length > 0 && {
      key: 'nooffice',
      icon: 'map-pin',
      count: noOffice.length,
      label: t('dashboard.noOfficeAssigned'),
      detail: t('dashboard.noOfficeHint'),
      to: '/employees',
    },
    pendingLeave > 0 && {
      key: 'leave',
      icon: 'plane',
      count: pendingLeave,
      label: t('leave.pending'),
      detail: t('dashboard.pendingLeaveHint'),
      to: '/leave',
    },
    neverLoggedIn > 0 && {
      key: 'nologin',
      icon: 'user',
      count: neverLoggedIn,
      label: t('dashboard.neverLoggedIn'),
      detail: t('dashboard.neverLoggedInHint'),
      to: '/employees',
    },
  ].filter(Boolean);

  return (
    <section className={`card blueprint ${className}`}>
      <div className="flex items-baseline justify-between">
        <h6 style={{ margin: 0, color: 'var(--color-accent)' }}>{t('dashboard.needsAttention')}</h6>
        <span className={items.length ? 'tag tag-outline' : 'tag tag-accent'}>{items.length}</span>
      </div>

      {items.length === 0 ? (
        <p className="flex items-center gap-2" style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>
          <Icon name="check" className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
          {t('dashboard.allClear')}
        </p>
      ) : (
        items.map((item) => (
          <Link
            key={item.key}
            to={item.to}
            className="flex items-center gap-2.5 py-2"
            style={{ borderTop: '1px solid color-mix(in srgb, var(--color-text) 8%, transparent)', color: 'inherit' }}
          >
            <span
              className="flex items-center justify-center shrink-0"
              style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--color-accent-100)', color: 'var(--color-accent-800)' }}
            >
              <Icon name={item.icon} className="w-3.5 h-3.5" />
            </span>
            <span className="flex-1 min-w-0" style={{ lineHeight: 1.25 }}>
              <span className="block truncate" style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</span>
              <span className="block truncate" style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>{item.detail}</span>
            </span>
            <span
              className="shrink-0"
              style={{ fontFamily: 'var(--font-heading)', fontSize: 17, fontVariantNumeric: 'tabular-nums' }}
            >
              {item.count}
            </span>
          </Link>
        ))
      )}
    </section>
  );
}
