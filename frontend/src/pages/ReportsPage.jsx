import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { userService } from '../services/userService';
import { geofenceService } from '../services/geofenceService';
import { attendanceService } from '../services/attendanceService';
import { reportService } from '../services/reportService';
import Icon from '../components/Icon';

export default function ReportsPage() {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [startDate, setStartDate] = useState(format(new Date(new Date().setDate(1)), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [department, setDepartment] = useState('');
  const [officeId, setOfficeId] = useState('');
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    userService.getAll().then(setEmployees).catch(() => {});
    geofenceService.getGeofences().then(setGeofences).catch(() => {});
  }, []);

  const departments = useMemo(() => [...new Set(employees.map((e) => e.department))], [employees]);

  const scopedEmployees = useMemo(
    () => employees.filter((e) => (!department || e.department === department) && (!officeId || e.officeLocationId === officeId)),
    [employees, department, officeId]
  );

  const generate = async () => {
    setBusy(true);
    try {
      const workingDays = Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1);
      const results = await Promise.all(
        scopedEmployees.map(async (e) => {
          const s = await attendanceService.getAttendanceSummary({ startDate, endDate, userId: e.id });
          const target = Number(e.workingHoursPerDay || 8) * workingDays;
          const site = geofences.find((g) => g.id === e.officeLocationId)?.name || '—';
          return {
            id: e.id, name: `${e.firstName} ${e.lastName}`, dept: e.department, site,
            days: s.totalDays, hours: s.totalHours, ot: s.overtimeHours,
            pct: target > 0 ? Math.min(100, Math.round((s.totalHours / target) * 100)) : 0,
          };
        })
      );
      setRows(results);
    } finally {
      setBusy(false);
    }
  };

  const stats = useMemo(() => {
    if (!rows) return null;
    const hours = rows.reduce((s, r) => s + r.hours, 0);
    const ot = rows.reduce((s, r) => s + r.ot, 0);
    return {
      hours: hours.toFixed(0),
      people: rows.length,
      ot: ot.toFixed(1),
      otPct: hours > 0 ? ((ot / hours) * 100).toFixed(1) : '0.0',
    };
  }, [rows]);

  const handleExport = async (fmt) => {
    if (!rows || rows.length === 0) return;
    try {
      const fn = fmt === 'excel' ? reportService.downloadExcel : reportService.downloadPDF;
      const [year, month] = startDate.split('-');
      await Promise.all(rows.map((r) => fn(Number(year), Number(month), r.id, r.name)));
      toast.success(t('common.success'));
    } catch {
      toast.error(t('errors.unexpectedError'));
    }
  };

  return (
    <div className="space-y-6">
      <section className="card p-4" style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div className="field w-[calc(50%-6px)] sm:w-[150px]"><label>{t('reports.from')}</label><input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div className="field w-[calc(50%-6px)] sm:w-[150px]"><label>{t('reports.to')}</label><input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        <div className="field w-[calc(50%-6px)] sm:w-[170px]">
          <label>{t('auth.department')}</label>
          <select className="input" value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">{t('common.all')}</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="field w-[calc(50%-6px)] sm:w-[170px]">
          <label>{t('attendance.officeLocation')}</label>
          <select className="input" value={officeId} onChange={(e) => setOfficeId(e.target.value)}>
            <option value="">{t('common.all')}</option>
            {geofences.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" style={{ height: 36 }} disabled={busy} onClick={generate}>
          <Icon name="play" className="w-4 h-4" />{busy ? t('common.loading') : t('reports.generateReport')}
        </button>
        <span className="flex gap-1.5 sm:ms-auto">
          <button className="btn btn-secondary" disabled={!rows?.length} onClick={() => handleExport('pdf')}><Icon name="file-text" className="w-4 h-4" />PDF</button>
          <button className="btn btn-secondary" disabled={!rows?.length} onClick={() => handleExport('excel')}><Icon name="sheet" className="w-4 h-4" />Excel</button>
        </span>
      </section>

      {stats && (
        <section className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
          <StatCard label={t('reports.hoursLogged')} value={stats.hours} note={`${stats.people} ${t('reports.people')} · ${startDate} – ${endDate}`} />
          <StatCard label={t('attendance.overtimeHours')} value={stats.ot} note={`${stats.otPct}% ${t('reports.ofTotalHours')}`} />
          <StatCard label={t('employees.employees')} value={stats.people} />
        </section>
      )}

      <section className="card p-4 overflow-x-auto">
        <div className="flex items-center justify-between">
          <h4>{t('reports.attendanceReport')}</h4>
          {rows && <span style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>{startDate} – {endDate} · {rows.length} {t('employees.employees').toLowerCase()}</span>}
        </div>
        {!rows ? (
          <p style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>{t('reports.noData')}</p>
        ) : (
          <table className="table mt-2">
            <thead>
              <tr>
                <th>{t('employees.employees')}</th>
                <th>{t('attendance.officeLocation')}</th>
                <th>{t('attendance.completed')}</th>
                <th>{t('attendance.totalHours')}</th>
                <th style={{ width: '26%' }}>{t('reports.loadVsTarget')}</th>
                <th>{t('attendance.overtimeHours')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="block" style={{ fontWeight: 500 }}>{r.name}</span>
                    <span className="block" style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>{r.dept}</span>
                  </td>
                  <td>{r.site}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.days}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.hours.toFixed(1)}</td>
                  <td>
                    <span className="flex items-center gap-2">
                      <span className="flex-1 rounded-full overflow-hidden" style={{ height: 7, background: 'var(--color-neutral-300)' }}>
                        <span className="block h-full rounded-full" style={{ background: 'var(--color-accent)', width: `${r.pct}%` }} />
                      </span>
                      <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--color-neutral-700)', width: 34 }}>{r.pct}%</span>
                    </span>
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.ot.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, note }) {
  return (
    <div className="card blueprint">
      <div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 30, lineHeight: 1.05 }}>{value}</div>
      {note && <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>{note}</div>}
    </div>
  );
}
