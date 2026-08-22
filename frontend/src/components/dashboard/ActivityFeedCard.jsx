import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import dashboardService from '../../services/dashboardService';
import { withLocale } from '../../utils/dateLocale';
import Icon from '../Icon';
import { SkeletonRows } from '../Skeleton';

const ACTION_ICON = {
  LOGIN: 'log-in',
  LOGOUT: 'log-out',
  CLOCK_IN: 'play',
  CLOCK_OUT: 'square',
  ATTENDANCE_EDIT: 'pencil-line',
  LEAVE_REQUEST: 'plane',
  LEAVE_APPROVE: 'check',
  LEAVE_REJECT: 'x',
  USER_CREATE: 'user-plus',
  USER_UPDATE: 'users',
  GEOFENCE_CREATE: 'map-pin',
  GEOFENCE_UPDATE: 'map-pin',
  GEOFENCE_DELETE: 'trash',
};

export default function ActivityFeedCard({ className = '' }) {
  const { t } = useTranslation();
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await dashboardService.getActivity(12);
        if (!cancelled) setActivity(data);
      } catch {
        // non-critical panel; leave it empty rather than breaking the page
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <section className={`card ${className}`}>
      <div className="flex items-baseline justify-between">
        <h6 style={{ margin: 0, color: 'var(--color-accent)' }}>{t('dashboard.activity')}</h6>
        <span style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>{t('dashboard.liveFeed')}</span>
      </div>

      {loading ? (
        <SkeletonRows count={5} avatar={false} trailing={false} />
      ) : activity.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>{t('dashboard.noActivity')}</p>
      ) : (
        <div className="flex flex-col max-h-80 overflow-y-auto">
          {activity.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-2.5 py-2"
              style={{ borderTop: '1px solid color-mix(in srgb, var(--color-text) 8%, transparent)' }}
            >
              <span
                className="flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  width: 24, height: 24, borderRadius: 7,
                  background: a.status === 'FAILURE' ? 'var(--color-neutral-200)' : 'var(--color-accent-100)',
                  color: a.status === 'FAILURE' ? 'var(--color-neutral-700)' : 'var(--color-accent-800)',
                }}
              >
                <Icon name={ACTION_ICON[a.action] || 'clock'} className="w-3 h-3" />
              </span>
              <span className="flex-1 min-w-0" style={{ lineHeight: 1.3 }}>
                <span className="block" style={{ fontSize: 12.5 }}>{describe(t, a)}</span>
                <span className="block" style={{ fontSize: 10.5, color: 'var(--color-neutral-600)' }}>
                  {formatDistanceToNow(new Date(a.timestamp), withLocale({ addSuffix: true }))}
                  {a.status === 'FAILURE' && ` · ${t('common.error')}`}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// The server stores an English description for the audit trail; the UI
// re-renders it from the structured action + actor so it follows the
// selected language, falling back to the stored text for unknown actions.
function describe(t, entry) {
  const name = entry.actor
    ? `${entry.actor.firstName} ${entry.actor.lastName}`
    : t('activity.someone');
  const key = `activity.${String(entry.action || '').toLowerCase()}`;
  const text = t(key, { name });
  return text === key ? entry.description || t('activity.unknown', { name }) : text;
}
