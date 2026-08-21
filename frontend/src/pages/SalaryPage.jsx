import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { dateLocale } from '../utils/dateLocale';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import { attendanceService } from '../services/attendanceService';
import { reportService } from '../services/reportService';

const AVG_WORKDAYS_PER_MONTH = 21.67;
const OVERTIME_MULTIPLIER = 1.5;
const CUR = '₾';

const estimateFor = (hours, overtimeHours, hourlyRate) => {
  const regular = Math.max(0, hours - overtimeHours) * hourlyRate;
  const overtime = overtimeHours * hourlyRate * OVERTIME_MULTIPLIER;
  return { regular, overtime, total: regular + overtime };
};

export default function SalaryPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState(null);
  const [ytd, setYtd] = useState([]);
  const [loading, setLoading] = useState(true);

  const salary = Number(user?.salary || 0);
  const workingHoursPerDay = Number(user?.workingHoursPerDay || 8);
  const hourlyRate = salary / (workingHoursPerDay * AVG_WORKDAYS_PER_MONTH || 1);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const ref = new Date(year, month - 1, 1);
      const s = await attendanceService.getAttendanceSummary({
        startDate: format(startOfMonth(ref), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(ref), 'yyyy-MM-dd'),
        userId: user?.id,
      });
      setSummary(s);
      setLoading(false);
    };
    load();
  }, [month, year, user?.id]);

  useEffect(() => {
    const currentMonth = new Date().getMonth() + 1;
    const load = async () => {
      const results = await Promise.all(
        Array.from({ length: currentMonth }, (_, i) => i + 1).map(async (m) => {
          const ref = new Date(year, m - 1, 1);
          const s = await attendanceService.getAttendanceSummary({
            startDate: format(startOfMonth(ref), 'yyyy-MM-dd'),
            endDate: format(endOfMonth(ref), 'yyyy-MM-dd'),
            userId: user?.id,
          });
          const est = estimateFor(s.totalHours || 0, s.overtimeHours || 0, hourlyRate);
          return { month: format(ref, 'MMM', { locale: dateLocale() }), amount: est.total, isCurrent: m === currentMonth };
        })
      );
      setYtd(results);
    };
    if (hourlyRate > 0) load();
  }, [year, hourlyRate, user?.id]);

  const totalHours = summary?.totalHours || 0;
  const overtimeHours = summary?.overtimeHours || 0;
  const est = estimateFor(totalHours, overtimeHours, hourlyRate);
  const maxYtd = Math.max(1, ...ytd.map((y) => y.amount));
  const ytdTotal = ytd.reduce((s, y) => s + y.amount, 0);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  const handleDownload = async (fmt) => {
    try {
      const fn = fmt === 'excel' ? reportService.downloadExcel : reportService.downloadPDF;
      await fn(year, month, user?.id, `${user?.firstName}-${user?.lastName}`);
    } catch {
      toast.error(t('errors.unexpectedError'));
    }
  };

  return (
    <div className="grid gap-6 items-start grid-cols-1 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <section className="card blueprint p-6">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h6 style={{ margin: 0, color: 'var(--color-accent)' }}>{t('salary.estimatedSalary')}</h6>
        </div>
        <div className="flex gap-2 mb-2">
          <select className="input w-auto" style={{ fontSize: 12 }} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {monthOptions.map((m) => <option key={m} value={m}>{format(new Date(2000, m - 1, 1), 'MMMM')}</option>)}
          </select>
          <select className="input w-auto" style={{ fontSize: 12 }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>{t('common.loading')}</p>
        ) : (
          <>
            <div className="flex items-baseline gap-1.5">
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 46, lineHeight: 1 }}>{CUR}{est.total.toFixed(0)}</span>
              <span style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>{t('salary.netSalary').toLowerCase()}</span>
            </div>
            <Row k={`${t('salary.baseSalary')} · ${totalHours.toFixed(1)}h`} v={`${CUR}${est.regular.toFixed(2)}`} />
            <Row k={`${t('salary.overtimePay')} · ${overtimeHours.toFixed(1)}h × ${OVERTIME_MULTIPLIER}`} v={`${CUR}${est.overtime.toFixed(2)}`} />
            <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--color-neutral-600)' }}>{t('salary.estimateNote')}</p>
            <div className="flex gap-2 mt-3">
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => handleDownload('excel')}>{t('reports.exportExcel')}</button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => handleDownload('pdf')}>{t('reports.exportPDF')}</button>
            </div>
          </>
        )}
      </section>

      <div className="flex flex-col gap-6">
        <section className="card p-6">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <div>
              <h6 style={{ margin: 0, color: 'var(--color-accent)' }}>{t('salary.ytd')}</h6>
              <h4>{CUR}{ytdTotal.toFixed(0)} {t('salary.totalEarned').toLowerCase()}</h4>
            </div>
            <span className="tag tag-neutral">{ytd.length} {t('salary.periods')}</span>
          </div>
          <div className="grid gap-3 items-end mt-4" style={{ gridTemplateColumns: `repeat(${Math.max(ytd.length, 1)}, 1fr)`, height: 168 }}>
            {ytd.map((y) => (
              <div key={y.month} className="flex flex-col items-center gap-1.5 justify-end" style={{ height: '100%' }}>
                <span style={{ fontSize: 10, color: 'var(--color-neutral-700)', fontVariantNumeric: 'tabular-nums' }}>{CUR}{(y.amount / 1000).toFixed(1)}k</span>
                <span style={{ display: 'block', width: '100%', height: `${Math.round((y.amount / maxYtd) * 100)}%`, borderRadius: 8, background: y.isCurrent ? 'var(--color-accent)' : 'var(--color-accent-400)' }} />
                <span style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>{y.month}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
          <StatCard label={t('salary.overtimeMultiplier')} value={`${OVERTIME_MULTIPLIER}x`} />
          <StatCard label={t('salary.hourlyRate')} value={`${CUR}${hourlyRate.toFixed(2)}`} note={`${t('salary.baseSalary')} ÷ ${(workingHoursPerDay * AVG_WORKDAYS_PER_MONTH).toFixed(0)}h`} />
          <StatCard label={t('salary.payPeriod')} value={format(endOfMonth(new Date(year, month - 1, 1)), 'd MMM')} note={format(new Date(year, month - 1, 1), 'MMMM yyyy')} />
        </section>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between" style={{ fontSize: 13, padding: '8px 0', borderTop: '1px solid color-mix(in srgb, var(--color-text) 8%, transparent)' }}>
      <span style={{ color: 'var(--color-neutral-700)' }}>{k}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</span>
    </div>
  );
}

function StatCard({ label, value, note }) {
  return (
    <div className="card">
      <div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 26, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>{note}</div>
    </div>
  );
}
