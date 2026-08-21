import bcryptjs from 'bcryptjs';
import { query } from '../config/database.js';
import { rowToCamel } from '../utils/rowMapper.js';

export const User = {
  async create({
    email, password, firstName, lastName, role, department, position, salary,
    workingHoursPerDay, phone, canCheckInFromAnywhere, officeLocationId,
  }) {
    const hashed = await bcryptjs.hash(password, 10);
    const { rows } = await query(
      `insert into users (
         email, password, first_name, last_name, role, department, position, salary,
         working_hours_per_day, phone, can_check_in_from_anywhere, office_location_id
       )
       values ($1, $2, $3, $4, coalesce($5, 'EMPLOYEE'), $6, $7, $8, coalesce($9, 8), $10, coalesce($11, false), $12)
       returning *`,
      [
        email.toLowerCase(), hashed, firstName, lastName, role, department, position, salary,
        workingHoursPerDay, phone, canCheckInFromAnywhere, officeLocationId || null,
      ]
    );
    return rowToCamel(rows[0]);
  },

  async update(id, fields) {
    const columnMap = {
      firstName: 'first_name',
      lastName: 'last_name',
      role: 'role',
      department: 'department',
      position: 'position',
      salary: 'salary',
      workingHoursPerDay: 'working_hours_per_day',
      phone: 'phone',
      canCheckInFromAnywhere: 'can_check_in_from_anywhere',
      officeLocationId: 'office_location_id',
      status: 'status',
    };

    const sets = [];
    const params = [id];
    for (const [key, column] of Object.entries(columnMap)) {
      if (fields[key] !== undefined) {
        params.push(fields[key] === '' ? null : fields[key]);
        sets.push(`${column} = $${params.length}`);
      }
    }
    if (sets.length === 0) return this.findById(id);

    const { rows } = await query(
      `update users set ${sets.join(', ')} where id = $1 returning *`,
      params
    );
    return rowToCamel(rows[0]);
  },

  async findByEmail(email) {
    const { rows } = await query('select * from users where email = $1', [email.toLowerCase()]);
    return rowToCamel(rows[0]);
  },

  async findById(id) {
    const { rows } = await query('select * from users where id = $1', [id]);
    return rowToCamel(rows[0]);
  },

  async findAll() {
    const { rows } = await query('select * from users order by first_name, last_name');
    return rows.map((row) => this.toSafeUser(rowToCamel(row)));
  },

  async findByRoles(roles) {
    const { rows } = await query('select * from users where role = any($1::text[])', [roles]);
    return rows.map((row) => this.toSafeUser(rowToCamel(row)));
  },

  async updateLastLogin(id) {
    const { rows } = await query(
      'update users set last_login = now() where id = $1 returning *',
      [id]
    );
    return rowToCamel(rows[0]);
  },

  async matchPassword(plainPassword, passwordHash) {
    return bcryptjs.compare(plainPassword, passwordHash);
  },

  toSafeUser(user) {
    if (!user) return null;
    const { password, ...safe } = user;
    return safe;
  },
};

export default User;
