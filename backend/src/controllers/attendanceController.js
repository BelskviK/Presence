import Attendance, { calculateHours } from '../models/Attendance.js';
import User from '../models/User.js';
import GeofenceLocation, { isWithinGeofence } from '../models/GeofenceLocation.js';
import Notification from '../models/Notification.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// Returns today's date as a plain YYYY-MM-DD string (in server-local time) so it
// maps unambiguously onto the Postgres `date` column, independent of timezone
// conversions the driver would otherwise apply to a JS Date object.
const startOfToday = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// If the user is assigned to a specific office, they must clock in from that
// exact location. Otherwise, any active office location counts (legacy behavior
// for employees who haven't been assigned one yet).
const findGeofenceMatch = async (latitude, longitude, user) => {
  let candidates = await GeofenceLocation.findActive();
  if (user.officeLocationId) {
    candidates = candidates.filter((loc) => loc.id === user.officeLocationId);
  }
  for (const location of candidates) {
    if (isWithinGeofence(location, latitude, longitude)) {
      return location;
    }
  }
  return null;
};

// Clock In
export const clockIn = asyncHandler(async (req, res) => {
  const { latitude, longitude, accuracy } = req.body;
  const userId = req.userId;

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({
      success: false,
      message: 'GPS coordinates (latitude, longitude) required',
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }
  if (user.role === 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Admin accounts are not attendance-tracked',
    });
  }

  const today = startOfToday();
  const flagged = await Attendance.flagStaleOpenShifts(userId, today);
  // One notification per flagged shift, each pointing at the specific record so
  // the UI can jump straight to it.
  await Promise.all(
    flagged.map((shift) => {
      const shiftDate = shift.date instanceof Date ? shift.date.toISOString().slice(0, 10) : String(shift.date).slice(0, 10);
      return Notification.create({
        userId,
        type: 'ATTENDANCE_MISSING_CLOCKOUT',
        title: 'Missing clock-out detected',
        message: `You forgot to clock out on your shift of ${shiftDate}. Ask a manager to correct it.`,
        relatedEntity: 'ATTENDANCE',
        relatedId: shift.id,
        meta: { date: shiftDate },
      });
    })
  );
  const openSession = await Attendance.findOpenToday(userId, today);

  if (openSession) {
    return res.status(400).json({
      success: false,
      message: 'You are already clocked in',
    });
  }

  let isWithin = false;
  let geofenceLocationId = null;

  if (!user.canCheckInFromAnywhere) {
    const match = await findGeofenceMatch(latitude, longitude, user);
    if (!match) {
      return res.status(403).json({
        success: false,
        message: 'You are not within a registered office location. Please go to office to clock in.',
        requiresGeofence: true,
      });
    }
    isWithin = true;
    geofenceLocationId = match.id;
  }

  const attendance = await Attendance.create({
    userId,
    date: today,
    clockInTime: new Date(),
    clockInGPS: {
      latitude,
      longitude,
      accuracy,
      isWithinGeofence: isWithin,
      geofenceLocationId,
    },
  });

  res.status(201).json({
    success: true,
    message: 'Clock in successful',
    attendance,
  });
});

// Clock Out
export const clockOut = asyncHandler(async (req, res) => {
  const { latitude, longitude, accuracy } = req.body;
  const userId = req.userId;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  const today = startOfToday();
  const attendance = await Attendance.findOpenToday(userId, today);

  if (!attendance) {
    return res.status(404).json({
      success: false,
      message: 'You are not currently clocked in',
    });
  }

  let isWithin = false;
  let geofenceLocationId = null;
  let clockOutGPS;

  if (latitude !== undefined && longitude !== undefined) {
    if (!user.canCheckInFromAnywhere) {
      const match = await findGeofenceMatch(latitude, longitude, user);
      if (match) {
        isWithin = true;
        geofenceLocationId = match.id;
      }
    }
    clockOutGPS = { latitude, longitude, accuracy, isWithinGeofence: isWithin, geofenceLocationId };
  }

  // Auto-close a break the employee forgot to end before clocking out, so it
  // still counts toward break_minutes instead of being silently lost.
  let breakMinutes = attendance.breakMinutes;
  if (attendance.breakStart) {
    const closed = await Attendance.endBreak(attendance.id);
    breakMinutes = closed.breakMinutes;
  }

  const clockOutTime = new Date();
  const { totalHours, overtimeHours, status } = calculateHours(attendance.clockInTime, clockOutTime, breakMinutes);

  const updated = await Attendance.clockOut(attendance.id, {
    clockOutTime,
    clockOutGPS,
    totalHours,
    overtimeHours,
    status,
  });

  res.json({
    success: true,
    message: 'Clock out successful',
    attendance: updated,
  });
});

// Start a break on today's shift
export const startBreak = asyncHandler(async (req, res) => {
  const attendance = await Attendance.findOpenToday(req.userId, startOfToday());
  if (!attendance) {
    return res.status(400).json({ success: false, message: 'You must be clocked in to start a break' });
  }
  if (attendance.breakStart) {
    return res.status(400).json({ success: false, message: 'Break already in progress' });
  }

  const updated = await Attendance.startBreak(attendance.id);
  res.json({ success: true, message: 'Break started', attendance: updated });
});

// End the current break on today's shift
export const endBreak = asyncHandler(async (req, res) => {
  const attendance = await Attendance.findOpenToday(req.userId, startOfToday());
  if (!attendance || !attendance.breakStart) {
    return res.status(400).json({ success: false, message: 'No break in progress' });
  }

  const updated = await Attendance.endBreak(attendance.id);
  res.json({ success: true, message: 'Break ended', attendance: updated });
});

// Get today's attendance: the currently open session (if any) or the most
// recent one today, plus totals aggregated across all of today's sessions
// (a day can have more than one clock-in/out cycle).
export const getTodayAttendance = asyncHandler(async (req, res) => {
  const sessions = await Attendance.findTodayRecords(req.userId, startOfToday());
  const current = sessions.find((s) => !s.clockOutTime) || sessions[sessions.length - 1] || null;

  const todaySummary = {
    sessions: sessions.length,
    totalHours: sessions.reduce((sum, s) => sum + (Number(s.totalHours) || 0), 0),
    overtimeHours: sessions.reduce((sum, s) => sum + (Number(s.overtimeHours) || 0), 0),
    breakMinutes: sessions.reduce((sum, s) => sum + (Number(s.breakMinutes) || 0), 0),
  };

  res.json({
    success: true,
    attendance: current,
    todaySummary,
    sessions,
  });
});

// Get attendance records (with filters)
export const getAttendanceRecords = asyncHandler(async (req, res) => {
  const { userId, startDate, endDate, status } = req.query;
  const currentUser = await User.findById(req.userId);

  if (currentUser.role === 'EMPLOYEE' && userId !== req.userId) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized access',
    });
  }

  const records = await Attendance.findRecords({ userId, status, startDate, endDate });

  res.json({
    success: true,
    records,
  });
});

// Get currently clocked-in employees
export const getActiveClockedIn = asyncHandler(async (req, res) => {
  const activeClock = await Attendance.findActiveClockedIn(startOfToday());
  res.json({
    success: true,
    activeClockedIn: activeClock,
  });
});

// Get attendance summary
export const getAttendanceSummary = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  let { userId } = req.query;

  const currentUser = await User.findById(req.userId);
  // Employees can only ever see their own summary, regardless of what's in the query string.
  if (currentUser.role === 'EMPLOYEE') {
    userId = req.userId;
  }

  const records = await Attendance.findForSummary({ userId, startDate, endDate });

  const summary = {
    // A day can have multiple sessions now, so count distinct dates, not rows.
    totalDays: new Set(records.map((r) => String(r.date))).size,
    totalHours: records.reduce((sum, r) => sum + (Number(r.totalHours) || 0), 0),
    overtimeHours: records.reduce((sum, r) => sum + (Number(r.overtimeHours) || 0), 0),
    completedDays: records.filter((r) => r.status === 'COMPLETED').length,
    pendingDays: records.filter((r) => r.status === 'PENDING').length,
    missingClockoutDays: records.filter((r) => r.status === 'MISSING_CLOCKOUT').length,
  };

  res.json({
    success: true,
    summary,
  });
});

// Edit attendance (Admin/Manager only)
export const editAttendance = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { clockInTime, clockOutTime, notes } = req.body;

  const attendance = await Attendance.update(id, { clockInTime, clockOutTime, notes, editedBy: req.userId });
  if (!attendance) {
    return res.status(404).json({
      success: false,
      message: 'Attendance record not found',
    });
  }

  res.json({
    success: true,
    message: 'Attendance updated',
    attendance,
  });
});
