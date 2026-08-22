import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { dateLocale } from '../../utils/dateLocale';
import Icon from '../Icon';
import { SkeletonRows } from '../Skeleton';

// Decide-right-here card: the requests a manager can clear without leaving
// the dashboard. Anything beyond the first few links through to the Leave page.
export default function PendingApprovalsCard({ approvals = [], total = 0, onAct, loading = false, className = '' }) {
  const { t } = useTranslation();

  return (
    <section className={`card ${className}`}>
      <div className="flex items-baseline justify-between">
        <h6 style={{ margin: 0, color: 'var(--color-accent)' }}>{t('leave.pending')}</h6>
        <span className={total > 0 ? 'tag tag-outline' : 'tag tag-accent'}>{total}</span>
      </div>

      {loading ? (
        <SkeletonRows count={2} avatar={false} />
      ) : approvals.length === 0 ? (
        <p className="flex items-center gap-2" style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>
          <Icon name="check" className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
          {t('dashboard.noPendingLeave')}
        </p>
      ) : (
        <>
          <div className="flex flex-col max-h-[320px] overflow-y-auto no-scrollbar">
            {approvals.map((a) => (
              <div
                key={a.id}
                className="py-2.5"
                style={{ borderTop: '1px solid color-mix(in srgb, var(--color-text) 8%, transparent)' }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate" style={{ fontSize: 13, fontWeight: 500 }}>
                    {a.userId?.firstName} {a.userId?.lastName}
                  </span>
                  <span className="shrink-0" style={{ fontSize: 11, color: 'var(--color-neutral-600)', fontVariantNumeric: 'tabular-nums' }}>
                    {format(new Date(a.startDate), 'MMM d', { locale: dateLocale() })} – {format(new Date(a.endDate), 'MMM d', { locale: dateLocale() })}
                  </span>
                </div>
                <div className="mb-2" style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>
                  {t(`leave.leaveTypes.${a.leaveType.toLowerCase()}`)} · {a.daysRequested} {t('time.days')}
                </div>
                <div className="flex gap-1.5">
                  <button className="btn btn-primary" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => onAct('approve', a.id)}>
                    {t('leave.approveLeave')}
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => onAct('reject', a.id)}>
                    {t('leave.rejectLeave')}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {total > approvals.length && (
            <Link to="/leave" className="btn btn-ghost" style={{ fontSize: 12, alignSelf: 'flex-start' }}>
              {t('dashboard.viewAllRequests', { count: total })}
              <Icon name="arrow-right" className="w-3.5 h-3.5" />
            </Link>
          )}
        </>
      )}
    </section>
  );
}
