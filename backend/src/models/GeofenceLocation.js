import { query } from '../config/database.js';
import { rowToCamel, rowsToCamel } from '../utils/rowMapper.js';

// Haversine distance check — is (latitude, longitude) within this geofence's radius?
export const isWithinGeofence = (geofence, latitude, longitude) => {
  const R = 6371000; // Earth's radius in meters
  const lat1 = (geofence.latitude * Math.PI) / 180;
  const lat2 = (latitude * Math.PI) / 180;
  const deltaLat = ((latitude - geofence.latitude) * Math.PI) / 180;
  const deltaLon = ((longitude - geofence.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // meters

  return distance <= geofence.radiusMeters;
};

export const GeofenceLocation = {
  async create({ name, address, latitude, longitude, radiusMeters, description, departmentsAllowed }) {
    const { rows } = await query(
      `insert into geofence_locations (name, address, latitude, longitude, radius_meters, description, departments_allowed)
       values ($1, $2, $3, $4, coalesce($5, 500), $6, coalesce($7::text[], '{}'))
       returning *`,
      [name, address, latitude, longitude, radiusMeters, description, departmentsAllowed]
    );
    return rowToCamel(rows[0]);
  },

  async findActive() {
    const { rows } = await query('select * from geofence_locations where is_active = true');
    return rowsToCamel(rows);
  },

  async findById(id) {
    const { rows } = await query('select * from geofence_locations where id = $1', [id]);
    return rowToCamel(rows[0]);
  },

  async update(id, fields) {
    const columnMap = {
      name: 'name',
      address: 'address',
      latitude: 'latitude',
      longitude: 'longitude',
      radiusMeters: 'radius_meters',
      description: 'description',
      departmentsAllowed: 'departments_allowed',
      isActive: 'is_active',
    };

    const sets = [];
    const params = [id];
    for (const [key, column] of Object.entries(columnMap)) {
      if (fields[key] !== undefined) {
        params.push(fields[key]);
        sets.push(`${column} = $${params.length}`);
      }
    }
    if (sets.length === 0) return this.findById(id);

    const { rows } = await query(
      `update geofence_locations set ${sets.join(', ')} where id = $1 returning *`,
      params
    );
    return rowToCamel(rows[0]);
  },

  async delete(id) {
    const { rows } = await query('delete from geofence_locations where id = $1 returning id', [id]);
    return rowToCamel(rows[0]);
  },

  async addFreeCheckInUsers(id, userIds) {
    const { rows } = await query(
      `update geofence_locations
       set users_can_check_in_from_anywhere = (
         select array_agg(distinct u) from unnest(users_can_check_in_from_anywhere || $2::uuid[]) as u
       )
       where id = $1
       returning *`,
      [id, userIds]
    );
    return rowToCamel(rows[0]);
  },

  async removeFreeCheckInUsers(id, userIds) {
    const { rows } = await query(
      `update geofence_locations
       set users_can_check_in_from_anywhere = (
         select coalesce(array_agg(u), '{}') from unnest(users_can_check_in_from_anywhere) as u
         where u != all($2::uuid[])
       )
       where id = $1
       returning *`,
      [id, userIds]
    );
    return rowToCamel(rows[0]);
  },
};

export default GeofenceLocation;
