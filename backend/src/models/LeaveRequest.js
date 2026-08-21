import { query } from '../config/database.js';
import { rowToCamel, rowsToCamel } from '../utils/rowMapper.js';

export const LeaveRequest = {
  async create({ userId, leaveType, startDate, endDate, daysRequested, reason, attachments }) {
    const { rows } = await query(
      `insert into leave_requests (user_id, leave_type, start_date, end_date, days_requested, reason, attachments)
       values ($1, $2, $3, $4, $5, $6, coalesce($7::text[], '{}'))
       returning *`,
      [userId, leaveType, startDate, endDate, daysRequested, reason, attachments]
    );
    return rowToCamel(rows[0]);
  },

  async findById(id) {
    const { rows } = await query('select * from leave_requests where id = $1', [id]);
    return rowToCamel(rows[0]);
  },

  async findByUser(userId) {
    const { rows } = await query(
      'select * from leave_requests where user_id = $1 order by start_date desc',
      [userId]
    );
    return rowsToCamel(rows);
  },

  async findAll({ status } = {}) {
    const conditions = [];
    const params = [];
    if (status) {
      params.push(status);
      conditions.push(`lr.status = $${params.length}`);
    }
    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
    const { rows } = await query(
      `select lr.*, u.first_name as user_first_name, u.last_name as user_last_name, u.email as user_email
       from leave_requests lr
       join users u on u.id = lr.user_id
       ${where}
       order by lr.created_at desc`,
      params
    );
    return rows.map((row) => {
      const camel = rowToCamel(row);
      const { userFirstName, userLastName, userEmail, userId, ...rest } = camel;
      return {
        ...rest,
        userId: { id: userId, firstName: userFirstName, lastName: userLastName, email: userEmail },
      };
    });
  },

  async setStatus(id, { status, approvedBy, approvalNotes }) {
    const { rows } = await query(
      `update leave_requests
       set status = $2, approved_by = $3, approval_date = now(), approval_notes = $4
       where id = $1
       returning *`,
      [id, status, approvedBy, approvalNotes]
    );
    return rowToCamel(rows[0]);
  },
};

export default LeaveRequest;
