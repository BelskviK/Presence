-- Attendance Management System — Postgres schema (Supabase)
create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- USERS -----------------------------------------------------------------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password text not null,
  first_name text not null,
  last_name text not null,
  role text not null default 'EMPLOYEE' check (role in ('EMPLOYEE','MANAGER','ADMIN')),
  department text not null,
  position text not null,
  salary numeric not null check (salary >= 0),
  working_hours_per_day numeric not null default 8 check (working_hours_per_day between 1 and 24),
  can_check_in_from_anywhere boolean not null default false,
  phone text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','ON_LEAVE')),
  last_login timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists users_set_updated_at on users;
create trigger users_set_updated_at before update on users
  for each row execute function set_updated_at();

-- GEOFENCE LOCATIONS ------------------------------------------------------
create table if not exists geofence_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  latitude double precision not null,
  longitude double precision not null,
  radius_meters int not null default 500 check (radius_meters between 100 and 5000),
  is_active boolean not null default true,
  description text,
  departments_allowed text[] not null default '{}',
  users_can_check_in_from_anywhere uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists geofence_set_updated_at on geofence_locations;
create trigger geofence_set_updated_at before update on geofence_locations
  for each row execute function set_updated_at();

-- ATTENDANCE --------------------------------------------------------------
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  clock_in_time timestamptz not null,
  clock_in_gps jsonb,
  clock_out_time timestamptz,
  clock_out_gps jsonb,
  total_hours numeric not null default 0,
  overtime_hours numeric not null default 0,
  status text not null default 'PENDING' check (status in ('COMPLETED','PENDING','MISSING_CLOCKOUT','INCOMPLETE')),
  notes text,
  edited_by uuid references users(id),
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists attendance_date_idx on attendance(date);
create index if not exists attendance_status_idx on attendance(status);

drop trigger if exists attendance_set_updated_at on attendance;
create trigger attendance_set_updated_at before update on attendance
  for each row execute function set_updated_at();

-- LEAVE REQUESTS ------------------------------------------------------------
create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  leave_type text not null check (leave_type in ('VACATION','SICK','PERSONAL','UNPAID','MATERNITY','OTHER')),
  start_date date not null,
  end_date date not null,
  days_requested numeric not null,
  reason text not null,
  attachments text[] not null default '{}',
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','CANCELLED')),
  approved_by uuid references users(id),
  approval_date timestamptz,
  approval_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leave_requests_user_status_idx on leave_requests(user_id, status);
create index if not exists leave_requests_dates_idx on leave_requests(start_date, end_date);

drop trigger if exists leave_requests_set_updated_at on leave_requests;
create trigger leave_requests_set_updated_at before update on leave_requests
  for each row execute function set_updated_at();

-- LEAVE BALANCES --------------------------------------------------------------
create table if not exists leave_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  year int not null,
  leave_type text not null check (leave_type in ('VACATION','SICK','PERSONAL','UNPAID','MATERNITY')),
  total_allowance numeric not null,
  used numeric not null default 0,
  remaining numeric not null default 0,
  carryover numeric not null default 0,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, year, leave_type)
);

create or replace function set_leave_remaining()
returns trigger as $$
begin
  new.remaining = new.total_allowance + new.carryover - new.used;
  new.last_updated = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists leave_balances_set_remaining on leave_balances;
create trigger leave_balances_set_remaining before insert or update on leave_balances
  for each row execute function set_leave_remaining();

-- AUDIT LOGS ------------------------------------------------------------------
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  action text not null check (action in (
    'LOGIN','LOGOUT','CLOCK_IN','CLOCK_OUT','LEAVE_REQUEST','LEAVE_APPROVE','LEAVE_REJECT',
    'USER_CREATE','USER_UPDATE','USER_DELETE','ATTENDANCE_EDIT',
    'GEOFENCE_CREATE','GEOFENCE_UPDATE','GEOFENCE_DELETE'
  )),
  target_entity text check (target_entity in ('USER','ATTENDANCE','LEAVE','GEOFENCE','SYSTEM')),
  target_id uuid,
  description text,
  changes jsonb,
  status text not null default 'SUCCESS' check (status in ('SUCCESS','FAILURE')),
  error_message text,
  ip_address text,
  user_agent text,
  "timestamp" timestamptz not null default now()
);

create index if not exists audit_logs_user_ts_idx on audit_logs(user_id, "timestamp" desc);
create index if not exists audit_logs_action_ts_idx on audit_logs(action, "timestamp" desc);
create index if not exists audit_logs_target_idx on audit_logs(target_entity, target_id);
