alter table attendance add column if not exists break_start timestamptz;
alter table attendance add column if not exists break_end timestamptz;
alter table attendance add column if not exists break_minutes numeric not null default 0;

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null check (type in ('LEAVE_NEW_REQUEST','LEAVE_APPROVED','LEAVE_REJECTED','ATTENDANCE_MISSING_CLOCKOUT')),
  title text not null,
  message text not null,
  related_entity text,
  related_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications(user_id, is_read, created_at desc);
