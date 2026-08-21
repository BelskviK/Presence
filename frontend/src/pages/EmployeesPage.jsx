import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { userService } from '../services/userService';
import { geofenceService } from '../services/geofenceService';
import { attendanceService } from '../services/attendanceService';
import { leaveService } from '../services/leaveService';
import Icon from '../components/Icon';

const ROLES = ['EMPLOYEE', 'MANAGER', 'ADMIN'];
const ROLE_TAG_CLASS = { ADMIN: 'tag tag-accent', MANAGER: 'tag tag-accent-2', EMPLOYEE: 'tag tag-neutral' };
const emptyForm = {
  firstName: '', lastName: '', email: '', department: '', officeLocationId: '', role: 'EMPLOYEE',
  canCheckInFromAnywhere: false, password: '', position: '', salary: '', workingHoursPerDay: 8,
};

function AddEmployeeDialog({ geofences, onClose, onCreated }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await userService.register({
        ...form,
        salary: Number(form.salary),
        workingHoursPerDay: Number(form.workingHoursPerDay),
        officeLocationId: form.officeLocationId || undefined,
      });
      toast.success(t('employees.createSuccess'));
      onCreated();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('employees.createFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop">
      <form onSubmit={step === 1 ? (e) => { e.preventDefault(); setStep(2); } : submit} className="dialog blueprint">
        <div className="flex items-start justify-between">
          <div>
            <h6 style={{ margin: 0, color: 'var(--color-accent)' }}>{t('common.step')} {step} / 2</h6>
            <div className="dialog-title">{t('employees.addEmployee')}</div>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose}><Icon name="x" className="w-4 h-4" /></button>
        </div>

        {step === 1 ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="field"><label>{t('auth.firstName')}</label><input required className="input" value={form.firstName} onChange={set('firstName')} /></div>
              <div className="field"><label>{t('auth.lastName')}</label><input required className="input" value={form.lastName} onChange={set('lastName')} /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>{t('auth.email')}</label><input required type="email" className="input" value={form.email} onChange={set('email')} /></div>
              <div className="field"><label>{t('auth.department')}</label><input required className="input" value={form.department} onChange={set('department')} /></div>
              <div className="field">
                <label>{t('attendance.officeLocation')}</label>
                <select className="input" value={form.officeLocationId} onChange={set('officeLocationId')}>
                  <option value="">{t('employees.noOfficeAssigned')}</option>
                  {geofences.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label>{t('auth.role')}</label>
                <span className="seg" style={{ width: '100%' }}>
                  {ROLES.map((r) => (
                    <label key={r} className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
                      <input type="radio" name="nrole" checked={form.role === r} onChange={() => setForm((f) => ({ ...f, role: r }))} />{r}
                    </label>
                  ))}
                </span>
              </div>
            </div>
            <label className="radio">
              <input type="checkbox" checked={form.canCheckInFromAnywhere} onChange={set('canCheckInFromAnywhere')} /><span className="dot" />
              {t('employees.canCheckInFromAnywhere')}
            </label>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
              <button type="submit" className="btn btn-primary">{t('common.continue')}</button>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="field" style={{ gridColumn: 'span 2' }}><label>{t('employees.temporaryPassword')}</label><input required type="password" minLength={6} className="input" value={form.password} onChange={set('password')} /></div>
              <div className="field"><label>{t('auth.position')}</label><input required className="input" value={form.position} onChange={set('position')} /></div>
              <div className="field"><label>{t('auth.salary')}</label><input required type="number" min={0} className="input" value={form.salary} onChange={set('salary')} /></div>
              <div className="field"><label>{t('attendance.workingHoursPerDay')}</label><input type="number" min={1} max={24} className="input" value={form.workingHoursPerDay} onChange={set('workingHoursPerDay')} /></div>
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>{t('common.back')}</button>
              <button type="submit" disabled={busy} className="btn btn-primary">{busy ? t('common.loading') : t('common.save')}</button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

export default function EmployeesPage() {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [activeNow, setActiveNow] = useState([]);
  const [onLeaveIds, setOnLeaveIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [emps, geos, active, approvedLeave] = await Promise.all([
        userService.getAll(),
        geofenceService.getGeofences(),
        attendanceService.getActiveClockedIn(),
        leaveService.getAllRequests('APPROVED'),
      ]);
      setEmployees(emps);
      setGeofences(geos);
      setActiveNow(active);
      const today = new Date();
      setOnLeaveIds(new Set(
        approvedLeave
          .filter((r) => new Date(r.startDate) <= today && new Date(r.endDate) >= today)
          .map((r) => r.userId?.id || r.userId)
      ));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const nowStatus = (empId) => {
    if (onLeaveIds.has(empId)) return { label: t('attendance.onLeaveNow'), color: 'var(--color-accent-2-400)' };
    const session = activeNow.find((a) => (a.userId?.id || a.userId) === empId);
    if (!session) return { label: t('attendance.offShift'), color: 'var(--color-neutral-400)' };
    if (session.breakStart) return { label: t('attendance.onBreak'), color: 'var(--color-accent-300)' };
    return { label: t('attendance.onShift'), color: 'var(--color-accent)' };
  };

  const reassignOffice = async (employeeId, officeLocationId) => {
    setSavingId(employeeId);
    try {
      const updated = await userService.update(employeeId, { officeLocationId: officeLocationId || '' });
      setEmployees((list) => list.map((e) => (e.id === employeeId ? updated : e)));
      toast.success(t('common.success'));
    } catch (err) {
      toast.error(err?.response?.data?.message || t('errors.unexpectedError'));
    } finally {
      setSavingId(null);
    }
  };

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (roleFilter !== 'ALL' && e.role !== roleFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!`${e.firstName} ${e.lastName} ${e.email} ${e.department}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [employees, roleFilter, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="seg">
          <label className="seg-opt"><input type="radio" name="role" checked={roleFilter === 'ALL'} onChange={() => setRoleFilter('ALL')} />{t('common.all')} {employees.length}</label>
          <label className="seg-opt"><input type="radio" name="role" checked={roleFilter === 'EMPLOYEE'} onChange={() => setRoleFilter('EMPLOYEE')} />{t('employees.employees')}</label>
          <label className="seg-opt"><input type="radio" name="role" checked={roleFilter === 'MANAGER'} onChange={() => setRoleFilter('MANAGER')} />{t('auth.managers')}</label>
          <label className="seg-opt"><input type="radio" name="role" checked={roleFilter === 'ADMIN'} onChange={() => setRoleFilter('ADMIN')} />{t('auth.admins')}</label>
        </span>
        <div className="relative w-full sm:w-[220px]">
          <Icon name="search" className="w-4 h-4 absolute" style={{ insetInlineStart: 9, top: 10, color: 'var(--color-neutral-600)' }} />
          <input className="input" style={{ paddingInlineStart: 30 }} placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary blueprint sm:ms-auto" style={{ height: 36 }} onClick={() => setShowAdd(true)}>
          <Icon name="user-plus" className="w-4 h-4" />{t('employees.addEmployee')}
        </button>
      </div>

      <section className="card p-4 overflow-x-auto">
        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>{t('common.loading')}</p>
        ) : filtered.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>{t('employees.noEmployees')}</p>
        ) : (
          <table className="table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>{t('auth.firstName')}</th>
                <th>{t('auth.department')}</th>
                <th>{t('auth.position')}</th>
                <th>{t('attendance.officeLocation')}</th>
                <th>{t('auth.role')}</th>
                <th>{t('common.today')}</th>
                <th style={{ textAlign: 'end' }}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => {
                const status = nowStatus(emp.id);
                return (
                  <tr key={emp.id}>
                    <td>
                      <span className="flex items-center gap-2.5">
                        <span className="flex items-center justify-center shrink-0" style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-neutral-200)', fontFamily: 'var(--font-heading)', fontSize: 10 }}>
                          {emp.firstName?.[0]}{emp.lastName?.[0]}
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <span className="block truncate" style={{ fontWeight: 500 }}>{emp.firstName} {emp.lastName}</span>
                          <span className="block truncate" style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>{emp.email}</span>
                        </span>
                      </span>
                    </td>
                    <td>{emp.department}</td>
                    <td>{emp.position}</td>
                    <td>
                      {emp.canCheckInFromAnywhere ? (
                        <span style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>{t('employees.canCheckInFromAnywhere')}</span>
                      ) : (
                        <select className="input" style={{ padding: '4px 8px', fontSize: 12, minHeight: 30 }} value={emp.officeLocationId || ''} disabled={savingId === emp.id} onChange={(e) => reassignOffice(emp.id, e.target.value)}>
                          <option value="">{t('employees.noOfficeAssigned')}</option>
                          {geofences.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                      )}
                    </td>
                    <td><span className={ROLE_TAG_CLASS[emp.role] || 'tag tag-neutral'}>{emp.role}</span></td>
                    <td>
                      <span className="flex items-center gap-1.5" style={{ fontSize: 12, whiteSpace: 'nowrap', color: 'var(--color-neutral-700)' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: status.color }} />{status.label}
                      </span>
                    </td>
                    <td>
                      <span className="flex gap-1 justify-end">
                        <StatusToggle employee={emp} onUpdated={(u) => setEmployees((list) => list.map((e) => (e.id === u.id ? u : e)))} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {showAdd && <AddEmployeeDialog geofences={geofences} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function StatusToggle({ employee, onUpdated }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const isActive = employee.status === 'ACTIVE';

  const toggle = async () => {
    setBusy(true);
    try {
      const updated = await userService.update(employee.id, { status: isActive ? 'INACTIVE' : 'ACTIVE' });
      onUpdated(updated);
      toast.success(t('common.success'));
      setConfirming(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || t('errors.unexpectedError'));
    } finally {
      setBusy(false);
    }
  };

  // Deactivating blocks the person from signing in, so it asks first rather
  // than firing on a single click.
  if (confirming) {
    return (
      <span className="flex gap-1 items-center">
        <button className="btn btn-primary" style={{ fontSize: 11, padding: '2px 8px' }} disabled={busy} onClick={toggle}>
          {busy ? '…' : t('common.yes')}
        </button>
        <button className="btn btn-secondary" style={{ fontSize: 11, padding: '2px 8px' }} disabled={busy} onClick={() => setConfirming(false)}>
          {t('common.no')}
        </button>
      </span>
    );
  }

  return (
    <button
      className="btn btn-ghost whitespace-nowrap"
      style={{ fontSize: 11, padding: '2px 8px' }}
      onClick={() => setConfirming(true)}
    >
      {isActive ? t('common.deactivate') : t('common.activate')}
    </button>
  );
}
