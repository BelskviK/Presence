import { useTranslation } from 'react-i18next';
import { Skeleton } from '../Skeleton';

// Month-to-date hours per person, ranked. Bars are relative to the busiest
// person so the spread is readable at a glance; overtime is called out
// separately because that's the number that costs money.
export default function TeamHoursCard({ byEmployee = [], loading = false, className = '' }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...byEmployee.map((e) => Number(e.hours)));

  return (
    <section className={`card ${className}`}>
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h6 style={{ margin: 0, color: 'var(--color-accent)' }}>{t('dashboard.teamHours')}</h6>
        <span style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>{t('dashboard.monthToDate')}</span>
      </div>

      {loading ? (
        <div className="flex flex-col">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="py-2" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-text) 8%, transparent)' }}>
              <div className="flex items-baseline justify-between gap-2">
                <Skeleton w="45%" h={11} />
                <Skeleton w={48} h={13} />
              </div>
              <div className="mt-1.5"><Skeleton h={6} style={{ borderRadius: 999 }} /></div>
              <div className="mt-1"><Skeleton w={62} h={9} /></div>
            </div>
          ))}
        </div>
      ) : byEmployee.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>{t('reports.noData')}</p>
      ) : (
        <div className="flex flex-col max-h-[360px] overflow-y-auto no-scrollbar">
        {byEmployee.map((e) => {
          const hours = Number(e.hours);
          const ot = Number(e.overtime);
          const pct = (hours / max) * 100;
          return (
            <div
              key={e.id}
              className="py-2"
              style={{ borderTop: '1px solid color-mix(in srgb, var(--color-text) 8%, transparent)' }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate" style={{ fontSize: 13 }}>
                  {e.firstName} {e.lastName}
                  <span style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}> · {e.department}</span>
                </span>
                <span className="shrink-0 flex items-baseline gap-1.5">
                  {ot > 0 && (
                    <span className="tag tag-outline" style={{ fontSize: 10, padding: '1px 7px' }}>
                      +{ot.toFixed(1)} {t('dashboard.otShort')}
                    </span>
                  )}
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>
                    {hours.toFixed(1)}h
                  </span>
                </span>
              </div>
              <div className="rounded-full overflow-hidden mt-1.5" style={{ height: 6, background: 'var(--color-neutral-200)' }}>
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${Math.max(hours > 0 ? 2 : 0, pct)}%`, background: 'var(--color-accent)' }}
                />
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-neutral-600)', marginTop: 3 }}>
                {e.days} {t('dashboard.daysWorked')}
              </div>
            </div>
          );
        })}
        </div>
      )}
    </section>
  );
}
