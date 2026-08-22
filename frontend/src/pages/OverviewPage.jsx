import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { dateLocale } from '../utils/dateLocale';
import useAuthStore from '../store/authStore';
import useClock from '../hooks/useClock';
import { attendanceService } from '../services/attendanceService';
import { leaveService } from '../services/leaveService';
import { userService } from '../services/userService';
import { geofenceService } from '../services/geofenceService';
import Icon from '../components/Icon';
import PresentNowWidget from '../components/PresentNowWidget';
import HoursTrendCard from '../components/dashboard/HoursTrendCard';
import NeedsAttentionCard from '../components/dashboard/NeedsAttentionCard';
import TeamHoursCard from '../components/dashboard/TeamHoursCard';
import ActivityFeedCard from '../components/dashboard/ActivityFeedCard';
import PendingApprovalsCard from '../components/dashboard/PendingApprovalsCard';
import dashboardService from '../services/dashboardService';
import { buildTimeline, dayTicks } from '../utils/timeline';
import { Skeleton, SkeletonRows } from '../components/Skeleton';

const StatCard = ({ label, value, unit, pct, note }) => (
  <div className="card">
    <div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>{label}</div>
    <div className="flex items-baseline gap-1.5">
      <span style={{ fontFamily: 'var(--font-heading)', fontSize: 30, lineHeight: 1 }}>{value}</span>
      {unit && <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>{unit}</span>}
    </div>
    {pct !== undefined && (
      <div className="rounded-full overflow-hidden mt-1.5" style={{ height: 5, background: 'var(--color-neutral-300)' }}>
        <span className="block h-full rounded-full" style={{ background: 'var(--color-accent)', width: `${Math.min(100, pct)}%` }} />
      </div>
    )}
    {note && <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>{note}</div>}
  </div>
);

export default function OverviewPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isManager = user?.role === 'MANAGER' || user?.role === 'ADMIN';
  const isAdmin = user?.role === 'ADMIN';
  const clock = useClock(!isAdmin);

  const [monthSummary, setMonthSummary] = useState(null);
  const [weekBars, setWeekBars] = useState([]);
  const [balances, setBalances] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [employeeCount, setEmployeeCount] = useState(null);
  const [officeName, setOfficeName] = useState(null);
  const [dash, setDash] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [dashLoading, setDashLoading] = useState(true);

  const load = useCallback(async () => {
    const start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const end = format(endOfMonth(new Date()), 'yyyy-MM-dd');
    const s = await attendanceService.getAttendanceSummary({ startDate: start, endDate: end, userId: isAdmin ? undefined : user?.id });
    setMonthSummary(s);

    if (!isAdmin) {
      const wkStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const wkEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
      const records = await attendanceService.getAttendanceRecords({
        userId: user?.id,
        startDate: format(wkStart, 'yyyy-MM-dd'),
        endDate: format(wkEnd, 'yyyy-MM-dd'),
      });
      const byDate = {};
      records.forEach((r) => {
        const key = format(new Date(r.date), 'yyyy-MM-dd');
        byDate[key] = (byDate[key] || 0) + Number(r.totalHours || 0);
      });
      const bars = Array.from({ length: 7 }, (_, i) => {
        const d = addDays(wkStart, i);
        const key = format(d, 'yyyy-MM-dd');
        const hrs = byDate[key] || 0;
        const pct = Math.max(hrs ? 4 : 0, (hrs / 9) * 100);
        const today = format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
        return {
          day: format(d, 'EEE', { locale: dateLocale() }),
          hours: hrs ? hrs.toFixed(1) : '—',
          style: {
            display: 'block', width: '100%', height: `${pct}%`, borderRadius: 8,
            background: hrs ? (today ? 'var(--color-accent)' : 'var(--color-accent-400)') : 'var(--color-neutral-300)',
          },
        };
      });
      setWeekBars(bars);

      const b = await leaveService.getMyBalance();
      setBalances(b);
    }

    if (isManager) {
      const pending = await leaveService.getAllRequests('PENDING');
      setApprovals(pending.slice(0, 3));
      setPendingCount(pending.length);
      const users = await userService.getAll();
      setEmployeeCount(users.length);
      // One aggregated call rather than a per-employee fan-out.
      dashboardService.getDashboard()
        .then(setDash)
        .catch(() => {})
        .finally(() => setDashLoading(false));
    }
  }, [isManager, isAdmin, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!clock.today?.clockInGPS?.geofenceLocationId) {
      setOfficeName(null);
      return;
    }
    geofenceService.getGeofences().then((locs) => {
      const match = locs.find((l) => l.id === clock.today.clockInGPS.geofenceLocationId);
      setOfficeName(match?.name || null);
    }).catch(() => {});
  }, [clock.today?.clockInGPS?.geofenceLocationId]);

  const vacation = balances.find((b) => b.leaveType === 'VACATION');
  const segments = buildTimeline(clock.sessions || []);
  const ticks = dayTicks();

  const act = async (action, id) => {
    if (action === 'approve') await leaveService.approve(id);
    if (action === 'reject') await leaveService.reject(id);
    load();
  };

  return (
    <div className="space-y-6">
      {/* Personal shift — the clock card leads, this week's chart sits beside it
          so neither is a lonely full-width strip. Admins aren't tracked, so
          this whole row is skipped for them. */}
      {!isAdmin && (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
          <section className="card blueprint p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--color-accent)' }}>
                  {t('common.today')} · {format(new Date(), 'EEE d MMM yyyy', { locale: dateLocale() })}
                </div>
                <div className="flex items-baseline gap-3 mt-1">
                  <ClockTimer isClockedIn={clock.isClockedIn} />
                  <span className="tag tag-accent">{clock.onBreak ? t('attendance.onBreak') : clock.isClockedIn ? t('attendance.onShift') : t('attendance.offShift')}</span>
                </div>
                {clock.today?.clockInTime && (
                  <div className="flex items-center gap-1.5 mt-2.5" style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
                    <Icon name="map-pin" className="w-4 h-4" />
                    <span>
                      {t('attendance.clockIn')} {format(new Date(clock.today.clockInTime), 'HH:mm')}
                      {officeName && ` · ${officeName}`}
                      {clock.today.clockInGPS && (clock.today.clockInGPS.isWithinGeofence ? ` · ${t('attendance.withinGeofence')}` : ` · ${t('attendance.outsideGeofence')}`)}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 items-center">
                {clock.isClockedIn && (
                  <button className="btn btn-secondary" style={{ height: 40 }} disabled={clock.breakBusy} onClick={clock.toggleBreak}>
                    <Icon name="coffee" className="w-4 h-4" />
                    {clock.breakBusy ? '…' : clock.onBreak ? t('attendance.endBreak') : t('attendance.startBreak')}
                  </button>
                )}
                <button className="btn btn-primary blueprint" style={{ height: 40, minWidth: 128 }} disabled={clock.busy} onClick={clock.toggleClock}>
                  <Icon name={clock.isClockedIn ? 'square' : 'play'} className="w-4 h-4" />
                  {clock.busy ? '…' : clock.isClockedIn ? t('attendance.clockOut') : t('attendance.clockIn')}
                </button>
              </div>
            </div>

            {clock.today?.clockInTime && (
              <div className="mt-2">
                <div className="flex justify-between mb-1" style={{ fontSize: 10, letterSpacing: '.08em', color: 'var(--color-neutral-600)' }}>
                  {ticks.map((tk) => <span key={tk}>{tk}</span>)}
                </div>
                <div
                  className="relative overflow-hidden"
                  style={{
                    height: 28, borderRadius: 10, border: '1px solid color-mix(in srgb, var(--color-text) 10%, transparent)',
                    background: 'repeating-linear-gradient(90deg, var(--color-neutral-100) 0 calc(100% / 12 - 1px), var(--color-neutral-300) calc(100% / 12 - 1px) calc(100% / 12))',
                  }}
                >
                  {segments.map((s, i) => <span key={i} style={s.style} />)}
                </div>
                <div className="flex gap-4 mt-2 flex-wrap" style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>
                  <span className="flex items-center gap-1.5">
                    <span style={{ width: 14, height: 8, borderRadius: 4, background: 'var(--color-accent)' }} />
                    {t('attendance.totalHours')} {Number(clock.todaySummary?.totalHours || 0).toFixed(2)}h
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span style={{ width: 14, height: 8, borderRadius: 4, background: 'var(--color-accent-200)', border: '1px solid var(--color-accent-300)' }} />
                    {t('attendance.breakMinutes')} {Math.round(clock.todaySummary?.breakMinutes || 0)}m
                  </span>
                  {clock.todaySummary?.sessions > 1 && (
                    <span className="flex items-center gap-1.5"><Icon name="repeat" className="w-3.5 h-3.5" />{clock.todaySummary.sessions} {t('attendance.sessions')}</span>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <h6 style={{ margin: 0, color: 'var(--color-accent)' }}>{t('common.today')}</h6>
                <h4>{format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'd MMM')} – {format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'd MMM')}</h4>
              </div>
              <Link to="/attendance" className="btn btn-ghost">
                {t('attendance.attendance')}<Icon name="arrow-right" className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid gap-2 items-end mt-4" style={{ gridTemplateColumns: 'repeat(7, 1fr)', height: 132 }}>
              {weekBars.map((w) => (
                <div key={w.day} className="flex flex-col items-center gap-1.5 justify-end" style={{ height: '100%' }}>
                  <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--color-neutral-700)' }}>{w.hours}</span>
                  <span style={w.style} />
                  <span style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>{w.day}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      <section className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(178px, 1fr))' }}>
          <StatCard label={t('attendance.totalHours')} value={(monthSummary?.totalHours || 0).toFixed(1)} unit="h" pct={Math.min(100, ((monthSummary?.totalHours || 0) / 160) * 100)} note={`${monthSummary?.completedDays ?? 0} ${t('attendance.completed').toLowerCase()}`} />
          <StatCard label={t('attendance.overtimeHours')} value={(monthSummary?.overtimeHours || 0).toFixed(1)} unit="h" pct={Math.min(100, ((monthSummary?.overtimeHours || 0) / 20) * 100)} />
          {!isAdmin && (
            <StatCard label={`${t('leave.leaveTypes.vacation')} ${t('leave.remaining').toLowerCase()}`} value={vacation ? Number(vacation.remaining).toFixed(0) : '-'} unit={t('time.days')} pct={vacation ? (Number(vacation.remaining) / Number(vacation.totalAllowance)) * 100 : 0} />
          )}
          {isManager ? (
            <StatCard label={t('employees.employees')} value={employeeCount ?? '-'} />
          ) : (
            <StatCard label={t('attendance.missingClockout')} value={monthSummary?.missingClockoutDays ?? 0} />
          )}
          {isManager && dash?.cost && (
            <StatCard
              label={t('dashboard.wageCost')}
              value={`₾${Math.round(dash.cost.estimatedMtd).toLocaleString()}`}
              pct={dash.cost.contractedMonthly > 0 ? (dash.cost.estimatedMtd / dash.cost.contractedMonthly) * 100 : 0}
              note={`${Math.round((dash.cost.estimatedMtd / (dash.cost.contractedMonthly || 1)) * 100)}% ${t('dashboard.ofContracted')}`}
            />
          )}
        </section>

      {/* Team panels. One grid, explicit spans: wide items take two columns so
          every row fills edge to edge instead of leaving a ragged gap.
            xl (3 cols): trend+attention / present+approvals+activity / hours+away
            md (2 cols): trend / attention+present / approvals+activity / hours / away */}
      {isManager && (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          <HoursTrendCard trend={dash?.trend} loading={dashLoading} className="md:col-span-2" />
          <NeedsAttentionCard exceptions={dash?.exceptions} pendingLeave={pendingCount} loading={dashLoading} />

          <PresentNowWidget />
          <PendingApprovalsCard approvals={approvals} total={pendingCount} onAct={act} loading={dashLoading} />
          <ActivityFeedCard />

          <TeamHoursCard byEmployee={dash?.byEmployee} loading={dashLoading} className="md:col-span-2" />
          <UpcomingAwayCard
            upcoming={dash?.upcomingLeave}
            liability={dash?.leaveLiability}
            loading={dashLoading}
            className="md:col-span-2 xl:col-span-1"
          />
        </div>
      )}
    </div>
  );
}

// Who's off in the next fortnight, plus how much leave the company still owes
// — the two leave numbers a manager actually plans around.
function UpcomingAwayCard({ upcoming = [], liability = [], loading = false, className = '' }) {
  const { t } = useTranslation();
  const vacation = liability.find((l) => l.leaveType === 'VACATION');

  return (
    <section className={`card ${className}`}>
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h6 style={{ margin: 0, color: 'var(--color-accent)' }}>{t('dashboard.awayNext14')}</h6>
        {loading ? (
          <Skeleton w={110} h={20} style={{ borderRadius: 999 }} />
        ) : vacation && (
          <span className="tag tag-neutral">
            {t('dashboard.leaveLiability')} {Number(vacation.remaining).toFixed(0)} {t('dashboard.days')}
          </span>
        )}
      </div>

      {loading ? (
        <SkeletonRows count={3} />
      ) : upcoming.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>{t('reports.noData')}</p>
      ) : (
        upcoming.map((o) => (
          <div
            key={o.id}
            className="flex items-center gap-2 py-1.5"
            style={{ borderTop: '1px solid color-mix(in srgb, var(--color-text) 8%, transparent)', fontSize: 12 }}
          >
            <span
              className="flex items-center justify-center shrink-0"
              style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-neutral-200)', fontFamily: 'var(--font-heading)', fontSize: 9 }}
            >
              {o.firstName?.[0]}{o.lastName?.[0]}
            </span>
            <span className="flex-1 min-w-0 truncate">{o.firstName} {o.lastName}</span>
            <span className="tag tag-accent-2 shrink-0" style={{ fontSize: 10, padding: '1px 7px' }}>
              {t(`leave.leaveTypes.${o.leaveType.toLowerCase()}`)}
            </span>
            <span className="shrink-0" style={{ whiteSpace: 'nowrap', color: 'var(--color-neutral-700)', fontVariantNumeric: 'tabular-nums' }}>
              {format(new Date(o.startDate), 'MMM d', { locale: dateLocale() })} – {format(new Date(o.endDate), 'MMM d', { locale: dateLocale() })}
            </span>
          </div>
        ))
      )}
    </section>
  );
}

function ClockTimer({ isClockedIn }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="text-[38px] sm:text-[54px]" style={{ fontFamily: 'var(--font-heading)', lineHeight: 1, fontVariantNumeric: 'tabular-nums', opacity: isClockedIn ? 1 : 0.5 }}>
      {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
    </span>
  );
}
