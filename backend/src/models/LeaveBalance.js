import { query } from '../config/database.js';
import { rowToCamel, rowsToCamel } from '../utils/rowMapper.js';

export const LeaveBalance = {
  async findByUserAndYear(userId, year) {
    const { rows } = await query(
      'select * from leave_balances where user_id = $1 and year = $2',
      [userId, year]
    );
    return rowsToCamel(rows);
  },

  async findOne(userId, year, leaveType) {
    const { rows } = await query(
      'select * from leave_balances where user_id = $1 and year = $2 and leave_type = $3',
      [userId, year, leaveType]
    );
    return rowToCamel(rows[0]);
  },

  async upsert({ userId, year, leaveType, totalAllowance, carryover }) {
    const { rows } = await query(
      `insert into leave_balances (user_id, year, leave_type, total_allowance, carryover)
       values ($1, $2, $3, $4, coalesce($5, 0))
       on conflict (user_id, year, leave_type)
       do update set total_allowance = excluded.total_allowance, carryover = excluded.carryover
       returning *`,
      [userId, year, leaveType, totalAllowance, carryover]
    );
    return rowToCamel(rows[0]);
  },

  async addUsedDays(userId, year, leaveType, daysUsed) {
    const { rows } = await query(
      `update leave_balances
       set used = used + $4
       where user_id = $1 and year = $2 and leave_type = $3
       returning *`,
      [userId, year, leaveType, daysUsed]
    );
    return rowToCamel(rows[0]);
  },
};

export default LeaveBalance;
