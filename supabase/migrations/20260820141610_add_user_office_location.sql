alter table users add column if not exists office_location_id uuid references geofence_locations(id) on delete set null;
