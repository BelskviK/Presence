import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { attendanceService } from '../services/attendanceService';
import useAuthStore from '../store/authStore';
import { buildTimeline, summariseDay, formatDuration } from '../utils/timeline';
import { demoTaskCounts } from '../utils/demoTasks';
import { Skeleton } from './Skeleton';

const STATUS_TAG = {
  WORKING: 'tag tag-accent',
  ON_BREAK: 'tag tag-outline',
  FINISHED: 'tag tag-neutral',
};

const STATUS_DOT = {
  WORKING: 'var(--color-accent)',
  ON_BREAK: 'var(--color-accent-300)',
  FINISHED: 'var(--color-neutral-400)',
};

export default function PresentNowWidget({ className = '' }) {
  const { t } = useTranslation();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  // Ticks so worked/break durations and the live break block keep moving.
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const today = format(new Date(), 'yyyy-MM-dd');
        const data = await attendanceService.getAttendanceRecords({ startDate: today, endDate: today });
        if (!cancelled) setRecords(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const refresh = setInterval(load, 30000);
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => {
      cancelled = true;
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, []);

  // Group today's sessions per person; a day can have several clock-in cycles.
  const people = useMemo(() => {
    const byUser = new Map();
    records.forEach((r) => {
      const u = typeof r.userId === 'object' && r.userId !== null ? r.userId : { id: r.userId };
      if (!byUser.has(u.id)) byUser.set(u.id, { user: u, sessions: [] });
      byUser.get(u.id).sessions.push(r);
    });

    return [...byUser.values()]
      .map(({ user, sessions }) => ({ user, sessions, ...summariseDay(sessions, now) }))
      .sort((a, b) => {
        const rank = { WORKING: 0, ON_BREAK: 1, FINISHED: 2, NONE: 3 };
        if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
        return b.workedMs - a.workedMs;
      });
  }, [records, now]);

  const onSiteCount = people.filter((p) => p.status === 'WORKING' || p.status === 'ON_BREAK').length;

  return (
    <section className={`card blueprint ${className}`}>
      <div className="flex items-baseline justify-between">
        <h6 style={{ margin: 0, color: 'var(--color-accent)' }}>{t('common.presentNow')}</h6>
        {loading
          ? <Skeleton w={40} h={15} />
          : <span style={{ fontFamily: 'var(--font-heading)', fontSize: 15 }}>{onSiteCount} / {people.length}</span>}
      </div>

      {loading ? (
        <div className="flex flex-col">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="py-2.5" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-text) 8%, transparent)' }}>
              <div className="flex items-center gap-2.5">
                <Skeleton w={28} h={28} style={{ borderRadius: '50%', flex: 'none' }} />
                <span className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <Skeleton w="55%" h={11} />
                  <Skeleton w="35%" h={9} />
                </span>
                <Skeleton w={62} h={16} style={{ borderRadius: 999, flex: 'none' }} />
              </div>
              <div className="mt-2"><Skeleton h={10} style={{ borderRadius: 6 }} /></div>
              <div className="mt-1.5"><Skeleton w="70%" h={9} /></div>
            </div>
          ))}
        </div>
      ) : people.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>{t('common.noOneClockedIn')}</p>
      ) : (
        <div className="flex flex-col max-h-[360px] overflow-y-auto">
          {people.map(({ user, sessions, workedMs, breakMs, status }) => {
            const tasks = demoTaskCounts(user.id);
            const segments = buildTimeline(sessions, now);
            return (
              <div
                key={user.id}
                className="py-2.5"
                style={{ borderTop: '1px solid color-mix(in srgb, var(--color-text) 8%, transparent)' }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex items-center justify-center shrink-0"
                    style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-neutral-200)', fontFamily: 'var(--font-heading)', fontSize: 10 }}
                  >
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </span>
                  <span className="flex-1 min-w-0" style={{ lineHeight: 1.2 }}>
                    <span className="block truncate" style={{ fontSize: 13 }}>{user.firstName} {user.lastName}</span>
                    <span className="block truncate" style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>{user.department}</span>
                  </span>
                  <span className={`${STATUS_TAG[status] || 'tag tag-neutral'} shrink-0`} style={{ fontSize: 10, padding: '2px 8px' }}>
                    <span className="inline-block me-1" style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_DOT[status] }} />
                    {t(`attendance.presence.${status.toLowerCase()}`)}
                  </span>
                </div>

                <div
                  className="relative overflow-hidden mt-2"
                  style={{
                    height: 10, borderRadius: 6,
                    border: '1px solid color-mix(in srgb, var(--color-text) 10%, transparent)',
                    background: 'var(--color-neutral-100)',
                  }}
                >
                  {segments.map((s, i) => <span key={i} style={s.style} />)}
                </div>

                <div className="flex items-center justify-between gap-2 mt-1.5" style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>
                  <span className="flex items-center gap-1" title={t('attendance.totalHours')}>
                    <span style={{ width: 10, height: 6, borderRadius: 3, background: 'var(--color-accent)' }} />
                    {formatDuration(workedMs)}
                  </span>
                  <span className="flex items-center gap-1" title={t('attendance.breakMinutes')}>
                    <span style={{ width: 10, height: 6, borderRadius: 3, background: 'var(--color-accent-200)', border: '1px solid var(--color-accent-300)' }} />
                    {formatDuration(breakMs)}
                  </span>
                  <span
                    className="flex items-center gap-1"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                    title={t('tasks.demoNotice')}
                  >
                    {t('tasks.tasks')} {tasks.done}/{tasks.total}
                    <span style={{ fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--color-neutral-500)' }}>
                      {t('tasks.demo')}
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isAdmin && (
        <Link to="/employees" className="btn btn-secondary btn-block">{t('employees.employees')}</Link>
      )}
    </section>
  );
}
