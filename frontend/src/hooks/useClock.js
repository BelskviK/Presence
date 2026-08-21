import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { attendanceService } from '../services/attendanceService';

// Shared clock-in/out + break state, used by both the header's compact clock
// pill and the Overview page's full clock card so the logic lives in one place.
export default function useClock(enabled = true) {
  const [today, setToday] = useState(null);
  const [todaySummary, setTodaySummary] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [breakBusy, setBreakBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const { attendance, todaySummary: ts, sessions: sess } = await attendanceService.getTodayAttendance();
    setToday(attendance);
    setTodaySummary(ts);
    setSessions(sess || []);
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isClockedIn = !!(today && today.clockInTime && !today.clockOutTime);
  const onBreak = !!today?.breakStart;

  const toggleClock = async () => {
    setBusy(true);
    try {
      const position = await attendanceService.getGPSLocation();
      const fn = isClockedIn ? attendanceService.clockOut : attendanceService.clockIn;
      await fn(position.latitude, position.longitude, position.accuracy);
      await refresh();
      return true;
    } catch (err) {
      if (err?.code === 1) {
        toast.error('Location access is required to clock in/out.');
      } else {
        toast.error(err?.response?.data?.message || 'Something went wrong.');
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  const toggleBreak = async () => {
    setBreakBusy(true);
    try {
      const fn = onBreak ? attendanceService.endBreak : attendanceService.startBreak;
      await fn();
      await refresh();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setBreakBusy(false);
    }
  };

  return { today, todaySummary, sessions, isClockedIn, onBreak, busy, breakBusy, toggleClock, toggleBreak, refresh };
}
