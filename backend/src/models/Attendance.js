import { query } from '../config/database.js';
import { rowToCamel, rowsToCamel } from '../utils/rowMapper.js';

// rowToCamel can't know "GPS" is an acronym (clock_in_gps -> clockInGps); fix it up.
const fixGpsCasing = (obj) => {
  if (!obj) return obj;
  const { clockInGps, clockOutGps, ...rest } = obj;
  return { ...rest, clockInGPS: clockInGps, clockOutGPS: clockOutGps };
};

// Calculates worked hours between clock-in and clock-out, net of any tracked
// break time. Works across midnight since both are full timestamps, not just
// times-of-day.
export const calculateHours = (clockInTime, clockOutTime, breakMinutes = 0) => {
  if (!clockOutTime) {
    return { totalHours: 0, overtimeHours: 0, status: 'PENDING' };
  }

  const diffMs = new Date(clockOutTime) - new Date(clockInTime);
  const diffHours = diffMs / (1000 * 60 * 60);

  const netHours = Math.max(0, diffHours - Number(breakMinutes || 0) / 60);
  const totalHours = Math.round(netHours * 100) / 100;
  const overtimeHours = netHours > 8 ? Math.round((netHours - 8) * 100) / 100 : 0;

  return { totalHours, overtimeHours, status: 'COMPLETED' };
};

const withUser = `
  select a.*, u.first_name as user_first_name, u.last_name as user_last_name,
         u.email as user_email, u.department as user_department
  from attendance a
  join users u on u.id = a.user_id
`;

const rowToAttendance = (row) => {
  if (!row) return null;
  const camel = fixGpsCasing(rowToCamel(row));
  const { userFirstName, userLastName, userEmail, userDepartment, userId, ...rest } = camel;
  if (userFirstName === undefined) return camel;
  return {
    ...rest,
    userId: {
      id: userId,
      firstName: userFirstName,
      lastName: userLastName,
      email: userEmail,
      department: userDepartment,
    },
  };
};

export const Attendance = {
  // Flags any still-open shift from a previous day as MISSING_CLOCKOUT, so a
  // forgotten clock-out doesn't stay PENDING forever and managers can spot it.
  async flagStaleOpenShifts(userId, beforeDate) {
    const { rows } = await query(
      `update attendance
       set status = 'MISSING_CLOCKOUT'
       where user_id = $1 and date < $2 and clock_out_time is null and status != 'MISSING_CLOCKOUT'
       returning id`,
      [userId, beforeDate]
    );
    return rows.length;
  },

  async startBreak(id) {
    const { rows } = await query(
      `update attendance set break_start = now()
       where id = $1 and break_start is null and clock_out_time is null
       returning *`,
      [id]
    );
    return fixGpsCasing(rowToCamel(rows[0]));
  },

  // Accumulates elapsed time into break_minutes and clears break_start so a
  // later break the same day starts fresh (break_minutes keeps the running total).
  async endBreak(id) {
    const { rows } = await query(
      `update attendance
       set break_minutes = round(break_minutes + extract(epoch from (now() - break_start)) / 60, 2),
           break_end = now(),
           break_start = null
       where id = $1 and break_start is not null
       returning *`,
      [id]
    );
    return fixGpsCasing(rowToCamel(rows[0]));
  },

  // The currently open session for today, if any (a user can clock in/out more
  // than once per day, so "today" may have several rows — at most one open).
  async findOpenToday(userId, date) {
    const { rows } = await query(
      'select * from attendance where user_id = $1 and date = $2 and clock_out_time is null order by clock_in_time desc limit 1',
      [userId, date]
    );
    return fixGpsCasing(rowToCamel(rows[0]));
  },

  async findTodayRecords(userId, date) {
    const { rows } = await query(
      'select * from attendance where user_id = $1 and date = $2 order by clock_in_time asc',
      [userId, date]
    );
    return rowsToCamel(rows).map(fixGpsCasing);
  },

  async findById(id) {
    const { rows } = await query('select * from attendance where id = $1', [id]);
    return fixGpsCasing(rowToCamel(rows[0]));
  },

  async create({ userId, date, clockInTime, clockInGPS }) {
    const { rows } = await query(
      `insert into attendance (user_id, date, clock_in_time, clock_in_gps, status)
       values ($1, $2, $3, $4, 'PENDING')
       returning *`,
      [userId, date, clockInTime, clockInGPS ? JSON.stringify(clockInGPS) : null]
    );
    return fixGpsCasing(rowToCamel(rows[0]));
  },

  async clockOut(id, { clockOutTime, clockOutGPS, totalHours, overtimeHours, status }) {
    const { rows } = await query(
      `update attendance
       set clock_out_time = $2, clock_out_gps = $3, total_hours = $4, overtime_hours = $5, status = $6
       where id = $1
       returning *`,
      [id, clockOutTime, clockOutGPS ? JSON.stringify(clockOutGPS) : null, totalHours, overtimeHours, status]
    );
    return fixGpsCasing(rowToCamel(rows[0]));
  },

  async update(id, { clockInTime, clockOutTime, notes, editedBy }) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const newClockIn = clockInTime ? new Date(clockInTime) : existing.clockInTime;
    const newClockOut = clockOutTime ? new Date(clockOutTime) : existing.clockOutTime;
    const newNotes = notes !== undefined ? notes : existing.notes;

    let totalHours = existing.totalHours;
    let overtimeHours = existing.overtimeHours;
    let status = existing.status;
    if (newClockIn && newClockOut) {
      ({ totalHours, overtimeHours, status } = calculateHours(newClockIn, newClockOut, existing.breakMinutes));
    }

    const { rows } = await query(
      `update attendance
       set clock_in_time = $2, clock_out_time = $3, notes = $4,
           total_hours = $5, overtime_hours = $6, status = $7,
           edited_by = $8, edited_at = now()
       where id = $1
       returning *`,
      [id, newClockIn, newClockOut, newNotes, totalHours, overtimeHours, status, editedBy]
    );
    return fixGpsCasing(rowToCamel(rows[0]));
  },

  // Limit is generous because the team calendar pulls a whole month across all
  // employees, and a truncated result would silently hide people's shifts.
  async findRecords({ userId, status, startDate, endDate, limit = 2000 } = {}) {
    const conditions = [];
    const params = [];

    if (userId) {
      params.push(userId);
      conditions.push(`a.user_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`a.status = $${params.length}`);
    }
    if (startDate) {
      params.push(startDate);
      conditions.push(`a.date >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      conditions.push(`a.date <= $${params.length}`);
    }

    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
    params.push(limit);

    const { rows } = await query(
      `${withUser} ${where} order by a.date desc, a.clock_in_time asc limit $${params.length}`,
      params
    );
    return rows.map((row) => rowToAttendance(row));
  },

  async findActiveClockedIn(date) {
    const { rows } = await query(
      `${withUser}
       where a.date = $1 and a.clock_in_time is not null and a.clock_out_time is null
       order by a.clock_in_time desc`,
      [date]
    );
    return rows.map((row) => rowToAttendance(row));
  },

  async findForSummary({ userId, startDate, endDate } = {}) {
    const conditions = [];
    const params = [];

    if (userId) {
      params.push(userId);
      conditions.push(`user_id = $${params.length}`);
    }
    if (startDate) {
      params.push(startDate);
      conditions.push(`date >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      conditions.push(`date <= $${params.length}`);
    }

    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
    const { rows } = await query(`select * from attendance ${where}`, params);
    return rowsToCamel(rows);
  },
};

export default Attendance;
