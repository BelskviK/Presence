import { useTranslation } from 'react-i18next';
import { format, subDays, isSameDay } from 'date-fns';
import { dateLocale } from '../../utils/dateLocale';
import { Skeleton, SkeletonChart } from '../Skeleton';

// Fourteen-day team output. Days with no data are drawn as empty slots rather
// than skipped, so gaps (weekends, shutdowns) stay visible.
export default function HoursTrendCard({ trend = [], loading = false, className = '' }) {
  const { t } = useTranslation();

  const days = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(new Date(), 13 - i);
    const match = trend.find((r) => isSameDay(new Date(r.date), date));
    return { date, hours: match ? Number(match.hours) : 0, people: match ? match.people : 0 };
  });

  const max = Math.max(1, ...days.map((d) => d.hours));
  const total = days.reduce((s, d) => s + d.hours, 0);
  const activeDays = days.filter((d) => d.hours > 0).length;
  const avg = activeDays ? total / activeDays : 0;

  if (loading) {
    return (
      <section className={`card ${className}`}>
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div className="flex flex-col gap-1.5">
            <h6 style={{ margin: 0, color: 'var(--color-accent)' }}>{t('dashboard.hoursTrend')}</h6>
            <Skeleton w={150} h={20} />
          </div>
          <Skeleton w={92} h={20} style={{ borderRadius: 999 }} />
        </div>
        <div className="mt-3"><SkeletonChart bars={14} height={120} /></div>
      </section>
    );
  }

  return (
    <section className={`card ${className}`}>
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <h6 style={{ margin: 0, color: 'var(--color-accent)' }}>{t('dashboard.hoursTrend')}</h6>
          <h4>{total.toFixed(1)}h · {t('dashboard.lastDays', { count: 14 })}</h4>
        </div>
        <span className="tag tag-neutral">{t('dashboard.avgPerDay')} {avg.toFixed(1)}h</span>
      </div>

      <div className="flex items-end gap-1 mt-3" style={{ height: 120 }}>
        {days.map((d, i) => {
          const pct = d.hours > 0 ? Math.max(6, (d.hours / max) * 100) : 0;
          const isToday = isSameDay(d.date, new Date());
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1" style={{ height: '100%' }}>
              <span style={{ fontSize: 9, color: 'var(--color-neutral-600)', fontVariantNumeric: 'tabular-nums' }}>
                {d.hours > 0 ? d.hours.toFixed(0) : ''}
              </span>
              <span
                title={`${format(d.date, 'MMM d', { locale: dateLocale() })} — ${d.hours.toFixed(1)}h · ${d.people} ${t('reports.people')}`}
                style={{
                  display: 'block', width: '100%', height: `${pct}%`, minHeight: d.hours > 0 ? 4 : 2,
                  borderRadius: 4,
                  background: d.hours === 0
                    ? 'var(--color-neutral-200)'
                    : isToday ? 'var(--color-accent)' : 'var(--color-accent-400)',
                }}
              />
              <span style={{ fontSize: 9, color: 'var(--color-neutral-600)', whiteSpace: 'nowrap' }}>
                {format(d.date, 'd')}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
