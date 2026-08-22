import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, startOfMonth, endOfMonth, addMonths, getDay, isToday, isFuture, isWeekend, startOfWeek, addDays } from 'date-fns';
import { dateLocale } from '../utils/dateLocale';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import { attendanceService } from '../services/attendanceService';
import { leaveService } from '../services/leaveService';
import { userService } from '../services/userService';
import { reportService } from '../services/reportService';
import Icon from '../components/Icon';
import StatusBadge from '../components/StatusBadge';
import { Skeleton } from '../components/Skeleton';

// Weekday headers come from the active locale rather than a hardcoded list,
// so the calendar reads correctly in every language.
const dowNames = () => {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'EEE', { locale: dateLocale() }));
};
const ymd = (d) => format(new Date(d), 'yyyy-MM-dd');
const idOf = (u) => (typeof u === 'object' && u !== null ? u.id : u);
const nameOf = (u) => (typeof u === 'object' && u !== null ? `${u.firstName} ${u.lastName}` : '—');

function EditModal({ record, onClose, onSaved }) {
  const { t } = useTranslation();
  const toLocalInput = (v) => (v ? format(new Date(v), "yyyy-MM-dd'T'HH:mm") : '');
  const [clockInTime, setClockInTime] = useState(toLocalInput(record.clockInTime));
  const [clockOutTime, setClockOutTime] = useState(toLocalInput(record.clockOutTime));
  const [notes, setNotes] = useState(record.notes || '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await attendanceService.editAttendance(record.id, {
        clockInTime: clockInTime ? new Date(clockInTime).toISOString() : undefined,
        clockOutTime: clockOutTime ? new Date(clockOutTime).toISOString() : undefined,
        notes,
      });
      toast.success(t('common.success'));
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('errors.unexpectedError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop">
      <div className="dialog">
        <div className="dialog-title">{t('common.edit')}</div>
        <div className="field">
          <label>{t('attendance.clockInTime')}</label>
          <input type="datetime-local" className="input" value={clockInTime} onChange={(e) => setClockInTime(e.target.value)} />
        </div>
        <div className="field">
          <label>{t('attendance.clockOutTime')}</label>
          <input type="datetime-local" className="input" value={clockOutTime} onChange={(e) => setClockOutTime(e.target.value)} />
        </div>
        <div className="field">
          <label>{t('common.notes')}</label>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>{t('common.save')}</button>
        </div>
      </div>
    </div>
  );
}

export default function AttendancePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER' || isAdmin;

  const [view, setView] = useState('calendar');
  const [monthDate, setMonthDate] = useState(startOfMonth(new Date()));
  const [employees, setEmployees] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(isAdmin ? '' : user?.id);
  const [records, setRecords] = useState([]);
  const [leaveDays, setLeaveDays] = useState([]);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  // No selected user = whole-team view (admins/managers only).
  const isTeamView = !selectedUserId;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const filters = { startDate: ymd(monthStart), endDate: ymd(monthEnd), userId: selectedUserId || undefined };

      const recordsData = await attendanceService.getAttendanceRecords(filters);
      setRecords(recordsData);

      const approved = isManager
        ? await leaveService.getAllRequests('APPROVED')
        : (await leaveService.getMyRequests()).filter((r) => r.status === 'APPROVED');

      setLeaveDays(
        approved
          .filter((r) => !selectedUserId || idOf(r.userId) === selectedUserId)
          .filter((r) => new Date(r.startDate) <= monthEnd && new Date(r.endDate) >= monthStart)
      );
    } finally {
      setLoading(false);
    }
  }, [monthDate, selectedUserId, isManager]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isManager) userService.getAll().then(setEmployees).catch(() => {});
  }, [isManager]);

  const dayInfo = (day) => {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
    const dateStr = ymd(date);
    const dayRecords = records.filter((r) => ymd(r.date) === dateStr);
    const hours = dayRecords.reduce((s, r) => s + Number(r.totalHours || 0), 0);
    const onLeave = leaveDays.filter((l) => dateStr >= ymd(l.startDate) && dateStr <= ymd(l.endDate));
    const workerIds = [...new Set(dayRecords.map((r) => idOf(r.userId)))];

    let status = '';
    if (isWeekend(date)) status = t('time.weekend');
    else if (isTeamView) status = '';
    else if (onLeave.length) status = t(`leave.leaveTypes.${onLeave[0].leaveType.toLowerCase()}`);
    else if (dayRecords.some((r) => r.status === 'MISSING_CLOCKOUT')) status = t('attendance.missingClockout');
    else if (dayRecords.some((r) => r.status === 'PENDING')) status = t('attendance.pending');
    else if (hours > 0) status = t('attendance.completed');

    return {
      date, hours, status, dayRecords, onLeave, workerIds,
      isWeekend: isWeekend(date),
      isFuture: isFuture(date) && !isToday(date),
      hasIssue: dayRecords.some((r) => r.status === 'MISSING_CLOCKOUT'),
    };
  };

  const daysInMonth = endOfMonth(monthDate).getDate();
  const firstDow = (getDay(startOfMonth(monthDate)) + 6) % 7; // Monday = 0
  const cells = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  const sel = dayInfo(selectedDay);
  const monthTotals = records.reduce(
    (acc, r) => ({
      hours: acc.hours + Number(r.totalHours || 0),
      overtime: acc.overtime + Number(r.overtimeHours || 0),
      needsFixing: acc.needsFixing + (r.status === 'MISSING_CLOCKOUT' ? 1 : 0),
    }),
    { hours: 0, overtime: 0, needsFixing: 0 }
  );
  const activeDays = new Set(records.map((r) => ymd(r.date))).size;

  const handleExport = async (fmt) => {
    const emp = employees.find((e) => e.id === selectedUserId) || user;
    const fn = fmt === 'excel' ? reportService.downloadExcel : reportService.downloadPDF;
    await fn(monthDate.getFullYear(), monthDate.getMonth() + 1, selectedUserId || user?.id, `${emp?.firstName}-${emp?.lastName}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary btn-icon" onClick={() => setMonthDate((d) => addMonths(d, -1))}><Icon name="chevron-left" className="w-4 h-4" /></button>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 18, minWidth: 130, textAlign: 'center' }}>{format(monthDate, 'MMMM yyyy', { locale: dateLocale() })}</span>
          <button className="btn btn-secondary btn-icon" onClick={() => setMonthDate((d) => addMonths(d, 1))}><Icon name="chevron-right" className="w-4 h-4" /></button>
        </div>
        <span className="seg">
          <label className="seg-opt"><input type="radio" name="attview" checked={view === 'calendar'} onChange={() => setView('calendar')} />{t('attendance.calendar')}</label>
          <label className="seg-opt"><input type="radio" name="attview" checked={view === 'list'} onChange={() => setView('list')} />{t('attendance.list')}</label>
        </span>
        {isManager && (
          <select className="input w-auto" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
            <option value="">{t('common.all')} {t('employees.employees')}</option>
            {!isAdmin && <option value={user?.id}>{t('profile.myProfile')}</option>}
            {employees.filter((e) => e.id !== user?.id).map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
          </select>
        )}
        {!isTeamView && (
          <button className="btn btn-ghost sm:ms-auto" onClick={() => handleExport('excel')}>
            <Icon name="download" className="w-4 h-4" />{t('reports.exportExcel')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid gap-6 items-start grid-cols-1 lg:grid-cols-[minmax(0,1fr)_304px]">
          <section className="card blueprint p-2 sm:p-4">
            <div className="grid gap-px" style={{ gridTemplateColumns: 'repeat(7, minmax(0,1fr))' }}>
              {Array.from({ length: 7 }, (_, i) => (
                <div key={`h${i}`} style={{ padding: '0 2px 8px' }}><Skeleton w={26} h={9} /></div>
              ))}
              {Array.from({ length: 35 }, (_, i) => (
                <div
                  key={i}
                  className="min-h-[56px] sm:min-h-[86px] p-1 sm:p-2 rounded-lg sm:rounded-xl"
                  style={{ border: '1px solid color-mix(in srgb, var(--color-text) 9%, transparent)' }}
                >
                  <Skeleton w={14} h={11} />
                </div>
              ))}
            </div>
          </section>
          <section className="flex flex-col gap-4">
            <div className="card p-4">
              <Skeleton w={90} h={11} />
              <div className="mt-2 mb-3"><Skeleton w={150} h={20} /></div>
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex justify-between py-2" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-text) 8%, transparent)' }}>
                  <Skeleton w={92} h={10} /><Skeleton w={52} h={10} />
                </div>
              ))}
            </div>
            <div className="card p-4">
              <Skeleton w={110} h={11} />
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex justify-between py-2" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-text) 8%, transparent)' }}>
                  <Skeleton w={84} h={10} /><Skeleton w={38} h={10} />
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : view === 'calendar' ? (
        <div className="grid gap-6 items-start grid-cols-1 lg:grid-cols-[minmax(0,1fr)_304px]">
          <section className="card blueprint p-2 sm:p-4">
            <div className="grid gap-px" style={{ gridTemplateColumns: 'repeat(7, minmax(0,1fr))' }}>
              {dowNames().map((d) => (
                <div key={d} className="truncate" style={{ fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--color-neutral-600)', padding: '0 2px 8px' }}>{d}</div>
              ))}
              {cells.map((day, i) => {
                if (!day) return <div key={i} className="min-h-[56px] sm:min-h-[86px]" />;
                const info = dayInfo(day);
                const on = selectedDay === day;
                const bg = info.isWeekend ? 'color-mix(in srgb, var(--color-text) 3%, transparent)' : on ? 'var(--color-accent-100)' : 'transparent';
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(day)}
                    className="flex flex-col gap-1 text-start min-h-[56px] sm:min-h-[86px] p-1 sm:p-2 rounded-lg sm:rounded-xl"
                    style={{
                      cursor: 'pointer',
                      border: `1px solid ${on ? 'var(--color-accent)' : 'color-mix(in srgb, var(--color-text) 9%, transparent)'}`,
                      background: bg, color: 'var(--color-text)',
                    }}
                  >
                    <span className="flex items-center justify-between gap-0.5">
                      <span style={{ fontFamily: 'var(--font-heading)', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{day}</span>
                      {info.hasIssue && <span title={t('attendance.missingClockout')} style={{ fontSize: 10, color: 'var(--color-neutral-600)' }}>!</span>}
                    </span>

                    {isTeamView ? (
                      <span className="flex flex-col gap-0.5 mt-auto" style={{ fontSize: 10, lineHeight: 1.3 }}>
                        {info.workerIds.length > 0 && (
                          <span className="flex items-center gap-1" style={{ color: 'var(--color-accent-800)' }}>
                            <span className="shrink-0" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent)' }} />
                            <span className="truncate">{info.workerIds.length} <span className="hidden sm:inline">{t('attendance.working')}</span></span>
                          </span>
                        )}
                        {info.onLeave.length > 0 && (
                          <span className="flex items-center gap-1" style={{ color: 'var(--color-neutral-700)' }}>
                            <span className="shrink-0" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent-2-400)' }} />
                            <span className="truncate">{info.onLeave.length} <span className="hidden sm:inline">{t('attendance.onLeaveNow')}</span></span>
                          </span>
                        )}
                      </span>
                    ) : (
                      <>
                        <span className="flex items-end gap-0.5 mt-auto h-[14px] sm:h-[30px]">
                          {info.hours > 0 && (
                            <span style={{ display: 'block', width: '100%', height: `${Math.max(12, (info.hours / 9) * 100)}%`, borderRadius: 6, background: info.hasIssue ? 'repeating-linear-gradient(135deg, var(--color-accent-400) 0 3px, var(--color-bg) 3px 6px)' : 'var(--color-accent-400)' }} />
                          )}
                        </span>
                        <span className="truncate" style={{ fontSize: 10, fontVariantNumeric: 'tabular-nums', color: 'var(--color-neutral-700)' }}>
                          {info.hours > 0 ? `${info.hours.toFixed(1)}h` : info.onLeave.length ? 'LV' : ''}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div className="card p-4">
              {sel.status && <h6 style={{ margin: 0, color: 'var(--color-accent)' }}>{sel.status}</h6>}
              <h3 className="mb-2">{format(sel.date, 'd MMMM yyyy', { locale: dateLocale() })}</h3>

              {isTeamView ? (
                <>
                  <Row k={t('attendance.working')} v={sel.workerIds.length} strong />
                  {sel.dayRecords.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 py-1.5" style={{ fontSize: 12, borderTop: '1px solid color-mix(in srgb, var(--color-text) 8%, transparent)' }}>
                      <span className="truncate">{nameOf(r.userId)}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-neutral-700)' }}>{Number(r.totalHours || 0).toFixed(2)}h</span>
                        {isManager && <button className="btn btn-ghost" style={{ fontSize: 11, padding: '0 4px' }} onClick={() => setEditing(r)}>{t('common.edit')}</button>}
                      </span>
                    </div>
                  ))}

                  <div className="mt-3">
                    <Row k={t('attendance.onLeaveNow')} v={sel.onLeave.length} strong />
                    {sel.onLeave.map((l) => (
                      <div key={l.id} className="flex items-center justify-between gap-2 py-1.5" style={{ fontSize: 12, borderTop: '1px solid color-mix(in srgb, var(--color-text) 8%, transparent)' }}>
                        <span className="truncate">{nameOf(l.userId)}</span>
                        <span className="tag tag-accent-2 shrink-0">{t(`leave.leaveTypes.${l.leaveType.toLowerCase()}`)}</span>
                      </div>
                    ))}
                  </div>

                  {sel.dayRecords.length === 0 && sel.onLeave.length === 0 && (
                    <p style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>{t('attendance.noRecords')}</p>
                  )}
                </>
              ) : sel.dayRecords.length === 0 ? (
                <>
                  {sel.onLeave.map((l) => (
                    <Row key={l.id} k={t('leave.leave')} v={t(`leave.leaveTypes.${l.leaveType.toLowerCase()}`)} />
                  ))}
                  {sel.onLeave.length === 0 && <p style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>{t('attendance.noRecords')}</p>}
                </>
              ) : (
                sel.dayRecords.map((r) => (
                  <div key={r.id}>
                    <Row k={t('attendance.clockInTime')} v={r.clockInTime ? format(new Date(r.clockInTime), 'HH:mm') : '-'} />
                    <Row k={t('attendance.clockOutTime')} v={r.clockOutTime ? format(new Date(r.clockOutTime), 'HH:mm') : '—'} />
                    <Row k={t('attendance.breakMinutes')} v={`${Math.round(r.breakMinutes || 0)} min`} />
                    <Row k={t('attendance.totalHours')} v={`${Number(r.totalHours || 0).toFixed(2)} h`} />
                    <Row k={t('attendance.overtimeHours')} v={`${Number(r.overtimeHours || 0).toFixed(2)} h`} />
                    {isManager && (
                      <button className="btn btn-secondary btn-block mt-2" onClick={() => setEditing(r)}>
                        <Icon name="pencil-line" className="w-4 h-4" />{t('common.edit')}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="card p-4">
              <h6 style={{ margin: 0, color: 'var(--color-accent)' }}>{t('attendance.summary')}</h6>
              <Row k={t('attendance.completed')} v={activeDays} />
              <Row k={t('attendance.totalHours')} v={monthTotals.hours.toFixed(1)} strong />
              <Row k={t('attendance.overtimeHours')} v={monthTotals.overtime.toFixed(1)} strong />
              <Row k={t('attendance.missingClockout')} v={monthTotals.needsFixing} />
            </div>
          </section>
        </div>
      ) : (
        <div className="card overflow-x-auto p-4">
          {records.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>{t('attendance.noRecords')}</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t('attendance.date')}</th>
                  {isTeamView && <th>{t('employees.employees')}</th>}
                  <th>{t('attendance.clockInTime')}</th>
                  <th>{t('attendance.clockOutTime')}</th>
                  <th>{t('attendance.totalHours')}</th>
                  <th>{t('attendance.status')}</th>
                  {isManager && <th style={{ textAlign: 'end' }}>{t('common.actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{format(new Date(r.date), 'MMM d, yyyy', { locale: dateLocale() })}</td>
                    {isTeamView && <td className="whitespace-nowrap">{nameOf(r.userId)}</td>}
                    <td>{r.clockInTime ? format(new Date(r.clockInTime), 'HH:mm') : '-'}</td>
                    <td>{r.clockOutTime ? format(new Date(r.clockOutTime), 'HH:mm') : '-'}</td>
                    <td>{Number(r.totalHours || 0).toFixed(2)}</td>
                    <td><StatusBadge status={r.status} label={t(`attendanceStatus.${r.status}`)} /></td>
                    {isManager && <td style={{ textAlign: 'end' }}><button className="btn btn-ghost" onClick={() => setEditing(r)}>{t('common.edit')}</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {editing && <EditModal record={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function Row({ k, v, strong }) {
  return (
    <div className="flex justify-between gap-2" style={{ fontSize: 13, padding: '7px 0', borderTop: '1px solid color-mix(in srgb, var(--color-text) 8%, transparent)' }}>
      <span style={{ color: 'var(--color-neutral-700)' }}>{k}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: strong ? 'var(--font-heading)' : undefined, fontSize: strong ? 15 : undefined }}>{v}</span>
    </div>
  );
}
