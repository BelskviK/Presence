import { query } from '../config/database.js';
import { rowToCamel, rowsToCamel } from '../utils/rowMapper.js';

export const Notification = {
  async create({ userId, type, title, message, relatedEntity, relatedId }) {
    const { rows } = await query(
      `insert into notifications (user_id, type, title, message, related_entity, related_id)
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [userId, type, title, message, relatedEntity || null, relatedId || null]
    );
    return rowToCamel(rows[0]);
  },

  // Fan out the same notification to several users (e.g. all managers/admins).
  async createForUsers(userIds, { type, title, message, relatedEntity, relatedId }) {
    await Promise.all(
      userIds.map((userId) => this.create({ userId, type, title, message, relatedEntity, relatedId }))
    );
  },

  async findByUser(userId, { limit = 30 } = {}) {
    const { rows } = await query(
      'select * from notifications where user_id = $1 order by created_at desc limit $2',
      [userId, limit]
    );
    return rowsToCamel(rows);
  },

  async countUnread(userId) {
    const { rows } = await query(
      'select count(*)::int as count from notifications where user_id = $1 and is_read = false',
      [userId]
    );
    return rows[0].count;
  },

  async markRead(id, userId) {
    const { rows } = await query(
      'update notifications set is_read = true where id = $1 and user_id = $2 returning *',
      [id, userId]
    );
    return rowToCamel(rows[0]);
  },

  async markAllRead(userId) {
    await query('update notifications set is_read = true where user_id = $1 and is_read = false', [userId]);
  },
};

export default Notification;
