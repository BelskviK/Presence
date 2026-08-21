// Shared shift-timeline maths, used by both the Overview clock card and the
// "who's present now" widget so the two always read the same way.

export const DAY_START = 7;
export const DAY_END = 19;

export const hourOf = (value) => {
  const d = new Date(value);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
};

export const segStyle = (from, to, kind) => {
  const span = DAY_END - DAY_START;
  const clampedFrom = Math.max(from, DAY_START);
  const clampedTo = Math.min(to, DAY_END);
  const left = ((clampedFrom - DAY_START) / span) * 100;
  const width = ((clampedTo - clampedFrom) / span) * 100;
  const fill = kind === 'break'
    ? { background: 'var(--color-accent-200)', border: '1px solid var(--color-accent-300)' }
    : { background: 'var(--color-accent)' };
  return {
    position: 'absolute', top: 0, bottom: 0,
    left: `${Math.max(0, left)}%`, width: `${Math.max(0, width)}%`,
    borderRadius: 6, ...fill,
  };
};

// Builds the coloured work/break blocks for one day's sessions.
//
// The schema keeps only a cumulative `breakMinutes` plus the *last* `breakEnd`,
// so multiple completed breaks in one session are drawn as a single block
// ending at that last break. Good enough for a glanceable bar; exact per-break
// history would need a separate breaks table.
export const buildTimeline = (sessions, now = new Date()) => {
  const nowH = hourOf(now);
  const segs = [];

  (sessions || []).forEach((s) => {
    if (!s.clockInTime) return;
    const inH = hourOf(s.clockInTime);
    const outH = s.clockOutTime ? hourOf(s.clockOutTime) : nowH;
    const breakHours = Number(s.breakMinutes || 0) / 60;

    if (s.breakStart) {
      // Currently on a break: work up to the break, then break until now.
      const bStartH = hourOf(s.breakStart);
      if (s.breakEnd && breakHours > 0) {
        const prevEndH = hourOf(s.breakEnd);
        const prevStartH = prevEndH - breakHours;
        segs.push({ style: segStyle(inH, prevStartH, 'work'), kind: 'work' });
        segs.push({ style: segStyle(prevStartH, prevEndH, 'break'), kind: 'break' });
        segs.push({ style: segStyle(prevEndH, bStartH, 'work'), kind: 'work' });
      } else {
        segs.push({ style: segStyle(inH, bStartH, 'work'), kind: 'work' });
      }
      segs.push({ style: segStyle(bStartH, nowH, 'break'), kind: 'break' });
      return;
    }

    if (s.breakEnd && breakHours > 0) {
      const bEndH = hourOf(s.breakEnd);
      const bStartH = bEndH - breakHours;
      segs.push({ style: segStyle(inH, bStartH, 'work'), kind: 'work' });
      segs.push({ style: segStyle(bStartH, bEndH, 'break'), kind: 'break' });
      segs.push({ style: segStyle(bEndH, outH, 'work'), kind: 'work' });
      return;
    }

    segs.push({ style: segStyle(inH, outH, 'work'), kind: 'work' });
  });

  return segs;
};

// Live break time for one session, including a break that's still running.
const sessionBreakMs = (s, now) => {
  let ms = Number(s.breakMinutes || 0) * 60000;
  if (s.breakStart) ms += now - new Date(s.breakStart);
  return Math.max(0, ms);
};

// Worked time is wall-clock on shift minus break time, so an open session
// keeps ticking and a running break correctly pauses it.
const sessionWorkedMs = (s, now) => {
  if (!s.clockInTime) return 0;
  const end = s.clockOutTime ? new Date(s.clockOutTime) : now;
  return Math.max(0, end - new Date(s.clockInTime) - sessionBreakMs(s, now));
};

export const summariseDay = (sessions, now = new Date()) => {
  const list = sessions || [];
  const workedMs = list.reduce((sum, s) => sum + sessionWorkedMs(s, now), 0);
  const breakMs = list.reduce((sum, s) => sum + sessionBreakMs(s, now), 0);

  let status = 'NONE';
  if (list.some((s) => s.breakStart)) status = 'ON_BREAK';
  else if (list.some((s) => s.clockInTime && !s.clockOutTime)) status = 'WORKING';
  else if (list.length > 0) status = 'FINISHED';

  // Named sessionCount, not `sessions`, so spreading this alongside a
  // `sessions` array can't silently clobber it with a number.
  return { workedMs, breakMs, status, sessionCount: list.length };
};

export const formatDuration = (ms) => {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
};

export const dayTicks = () =>
  Array.from({ length: (DAY_END - DAY_START) / 2 + 1 }, (_, i) => String(DAY_START + i * 2).padStart(2, '0'));
