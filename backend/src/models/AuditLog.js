import { query } from '../config/database.js';
import { rowToCamel, rowsToCamel } from '../utils/rowMapper.js';

export const AuditLog = {
  async findRecent({ limit = 20 } = {}) {
    const { rows } = await query(
      `select l.*, u.first_name, u.last_name, u.role
       from audit_logs l
       left join users u on u.id = l.user_id
       order by l."timestamp" desc
       limit $1`,
      [limit]
    );
    return rowsToCamel(rows).map(({ firstName, lastName, role, ...rest }) => ({
      ...rest,
      actor: firstName ? { firstName, lastName, role } : null,
    }));
  },

  async create({ userId, action, targetEntity, targetId, description, changes, status, errorMessage, ipAddress, userAgent }) {
    const { rows } = await query(
      `insert into audit_logs (user_id, action, target_entity, target_id, description, changes, status, error_message, ip_address, user_agent)
       values ($1, $2, $3, $4, $5, $6, coalesce($7, 'SUCCESS'), $8, $9, $10)
       returning *`,
      [userId, action, targetEntity, targetId, description, changes ? JSON.stringify(changes) : null, status, errorMessage, ipAddress, userAgent]
    );
    return rowToCamel(rows[0]);
  },
};

export default AuditLog;
