import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { geofenceService } from '../services/geofenceService';
import { attendanceService } from '../services/attendanceService';
import { userService } from '../services/userService';
import Icon from '../components/Icon';
import { Skeleton } from '../components/Skeleton';

const emptyForm = { name: '', address: '', latitude: '', longitude: '', radiusMeters: 500, description: '', isActive: true };

function LocationForm({ initial, title, onClose, onSaved, onSubmit }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const pos = await attendanceService.getGPSLocation();
      setForm((f) => ({ ...f, latitude: pos.latitude, longitude: pos.longitude }));
    } catch {
      toast.error(t('attendance.locationDenied'));
    } finally {
      setLocating(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({ ...form, latitude: Number(form.latitude), longitude: Number(form.longitude), radiusMeters: Number(form.radiusMeters) });
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
      <form onSubmit={submit} className="dialog">
        <div className="dialog-title">{title}</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="field" style={{ gridColumn: 'span 2' }}><label>{t('attendance.officeLocation')}</label><input required className="input" value={form.name} onChange={set('name')} /></div>
          <div className="field" style={{ gridColumn: 'span 2' }}><label>{t('common.address')}</label><input className="input" value={form.address} onChange={set('address')} /></div>
          <div className="field"><label>{t('common.latitude')}</label><input required type="number" step="any" className="input" value={form.latitude} onChange={set('latitude')} /></div>
          <div className="field"><label>{t('common.longitude')}</label><input required type="number" step="any" className="input" value={form.longitude} onChange={set('longitude')} /></div>
          <div className="field" style={{ gridColumn: 'span 2' }}><label>{t('geofence.radius')}</label><input required type="number" min={100} max={5000} className="input" value={form.radiusMeters} onChange={set('radiusMeters')} /></div>
          <div className="field" style={{ gridColumn: 'span 2' }}><label>{t('common.description')}</label><textarea className="input" rows={2} value={form.description} onChange={set('description')} /></div>
        </div>
        {'isActive' in initial && (
          <label className="radio"><input type="checkbox" checked={form.isActive} onChange={set('isActive')} /><span className="dot" />{t('common.active')}</label>
        )}
        <button type="button" className="btn btn-ghost" style={{ fontSize: 12, alignSelf: 'flex-start' }} onClick={useMyLocation} disabled={locating}>
          <Icon name="map-pin" className="w-3.5 h-3.5" />{locating ? t('common.loading') : t('geofence.useMyLocation')}
        </button>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" disabled={busy} className="btn btn-primary">{t('common.save')}</button>
        </div>
      </form>
    </div>
  );
}

export default function GeofencesPage() {
  const { t } = useTranslation();
  const [locations, setLocations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [activeNow, setActiveNow] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [locs, emps, active] = await Promise.all([
        geofenceService.getGeofences(),
        userService.getAll(),
        attendanceService.getActiveClockedIn(),
      ]);
      setLocations(locs);
      setEmployees(emps);
      setActiveNow(active);
      setSelected((s) => s || locs[0]?.id || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id) => {
    try {
      await geofenceService.deleteGeofence(id);
      toast.success(t('common.success'));
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('errors.unexpectedError'));
    }
  };

  const counts = useMemo(() => {
    const map = {};
    locations.forEach((loc) => {
      const assigned = employees.filter((e) => e.officeLocationId === loc.id);
      const inside = assigned.filter((e) => activeNow.some((a) => (a.userId?.id || a.userId) === e.id)).length;
      map[loc.id] = { assigned: assigned.length, inside };
    });
    return map;
  }, [locations, employees, activeNow]);

  const selectedLoc = locations.find((l) => l.id === selected);

  return (
    <div className="space-y-4">
      <div className="grid gap-6 items-start grid-cols-1 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <button className="btn btn-primary blueprint" style={{ height: 40 }} onClick={() => setShowAdd(true)}>
            <Icon name="plus" className="w-4 h-4" />{t('geofence.addLocation')}
          </button>
          {loading ? (
            Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="card">
                <div className="flex items-baseline justify-between">
                  <Skeleton w={110} h={18} /><Skeleton w={58} h={18} style={{ borderRadius: 999 }} />
                </div>
                <Skeleton w={140} h={10} />
                <div className="flex items-center gap-2 mt-1">
                  <Skeleton w={54} h={10} style={{ flex: 'none' }} />
                  <Skeleton h={6} style={{ borderRadius: 999 }} />
                  <Skeleton w={40} h={10} style={{ flex: 'none' }} />
                </div>
                <div className="pt-2 mt-1" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-text) 8%, transparent)' }}>
                  <Skeleton w="70%" h={10} />
                </div>
              </div>
            ))
          ) : locations.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>{t('geofence.noLocations')}</p>
          ) : (
            locations.map((loc) => {
              const c = counts[loc.id] || { assigned: 0, inside: 0 };
              const pct = Math.min(100, (loc.radiusMeters / 2000) * 100);
              return (
                <div
                  key={loc.id}
                  onClick={() => setSelected(loc.id)}
                  className="card"
                  style={{ cursor: 'pointer', borderColor: selected === loc.id ? 'var(--color-accent)' : undefined }}
                >
                  <div className="flex items-baseline justify-between">
                    <h4>{loc.name}</h4>
                    <div className="flex gap-2 items-center">
                      <span className={loc.isActive ? 'tag tag-accent' : 'tag tag-neutral'}>{loc.isActive ? t('common.active') : t('common.inactive')}</span>
                    </div>
                  </div>
                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--color-neutral-600)' }}>
                    {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span style={{ fontSize: 11, color: 'var(--color-neutral-700)', width: 62 }}>{t('geofence.radius')}</span>
                    <span className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: 'var(--color-neutral-300)' }}>
                      <span className="block h-full rounded-full" style={{ background: 'var(--color-accent)', width: `${pct}%` }} />
                    </span>
                    <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{loc.radiusMeters} m</span>
                  </div>
                  <div className="flex justify-between gap-2 mt-1 flex-wrap" style={{ fontSize: 11, whiteSpace: 'nowrap', color: 'var(--color-neutral-600)', borderTop: '1px solid color-mix(in srgb, var(--color-text) 8%, transparent)', paddingTop: 8 }}>
                    <span>{c.assigned} {t('geofence.assigned')}</span>
                    <span>{c.inside} {t('geofence.insideNow')}</span>
                    <span className="flex gap-2">
                      <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '1px 6px' }} onClick={(e) => { e.stopPropagation(); setEditing(loc); }}>{t('common.edit')}</button>
                      <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '1px 6px' }} onClick={(e) => { e.stopPropagation(); remove(loc.id); }}>{t('common.delete')}</button>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <section className="card blueprint p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h6 style={{ margin: 0, color: 'var(--color-accent)' }}>{t('geofence.geofence')}</h6>
              <h4>{selectedLoc ? `${selectedLoc.name} · ${selectedLoc.radiusMeters} m` : t('geofence.noLocations')}</h4>
            </div>
          </div>
          <div
            className="grid place-items-center mt-3"
            style={{
              height: 420, borderRadius: 12, border: '1px solid var(--color-divider)',
              backgroundImage:
                'repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-text) 8%, transparent) 0 1px, transparent 1px 9px), repeating-linear-gradient(0deg, color-mix(in srgb, var(--color-text) 6%, transparent) 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, color-mix(in srgb, var(--color-text) 6%, transparent) 0 1px, transparent 1px 40px)',
            }}
          >
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '.08em', color: 'var(--color-neutral-700)', background: 'var(--color-bg)', padding: '6px 12px', borderRadius: 999, border: '1px solid var(--color-divider)' }}>
              [ {t('geofence.mapPlaceholder')} ]
            </span>
          </div>
          {selectedLoc && (
            <div className="flex gap-6 mt-3 flex-wrap" style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>
              <span>{selectedLoc.latitude.toFixed(4)}° N, {selectedLoc.longitude.toFixed(4)}° E</span>
              <span>{(counts[selectedLoc.id]?.inside) || 0} {t('geofence.insideFence')}</span>
              <span>{(counts[selectedLoc.id]?.assigned) || 0} {t('geofence.peopleAssigned')}</span>
            </div>
          )}
        </section>
      </div>

      {showAdd && <LocationForm initial={emptyForm} title={t('geofence.addLocation')} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} onSubmit={(data) => geofenceService.createGeofence(data)} />}
      {editing && (
        <LocationForm
          initial={{ name: editing.name, address: editing.address || '', latitude: editing.latitude, longitude: editing.longitude, radiusMeters: editing.radiusMeters, description: editing.description || '', isActive: editing.isActive }}
          title={t('common.edit')}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          onSubmit={(data) => geofenceService.updateGeofence(editing.id, data)}
        />
      )}
    </div>
  );
}
