import { query } from '../config/database.js';
import { rowsToCamel } from '../utils/rowMapper.js';
import AuditLog from '../models/AuditLog.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// Matches the frontend salary estimate so the dashboard and the Salary page
// can't drift apart.
const AVG_WORKDAYS_PER_MONTH = 21.67;
const OVERTIME_MULTIPLIER = 1.5;
const TREND_DAYS = 14;

// Everything the admin overview needs, aggregated in the database rather than
// fetched per-employee from the client.
export const getDashboard = asyncHandler(async (req, res) => {
  const [trend, byEmployee, exceptions, openShifts, unassigned, liability, upcoming, cost] = await Promise.all([
    query(
      `select a.date,
              round(sum(a.total_hours), 2)::float as hours,
              count(distinct a.user_id)::int as people
       from attendance a
       where a.date > current_date - $1::int
       group by a.date
       order by a.date`,
      [TREND_DAYS]
    ),

    query(
      `select u.id, u.first_name, u.last_name, u.department,
              coalesce(sum(a.total_hours), 0)::float as hours,
              coalesce(sum(a.overtime_hours), 0)::float as overtime,
              count(distinct a.date)::int as days
       from users u
       left join attendance a
         on a.user_id = u.id and a.date >= date_trunc('month', current_date)
       where u.role <> 'ADMIN' and u.status = 'ACTIVE'
       group by u.id, u.first_name, u.last_name, u.department
       order by hours desc`
    ),

    query(
      `select
         count(*) filter (where status = 'MISSING_CLOCKOUT')::int as missing_clockouts,
         count(*) filter (where clock_out_time is null and date < current_date)::int as stale_open,
         count(*) filter (where status = 'PENDING' and date = current_date)::int as open_today
       from attendance`
    ),

    query(
      `select a.id, a.date, u.first_name, u.last_name
       from attendance a join users u on u.id = a.user_id
       where a.clock_out_time is null and a.date < current_date
       order by a.date desc limit 5`
    ),

    // GPS is only enforced for people tied to an office, so anyone without one
    // (and not explicitly exempt) is silently unmonitored.
    query(
      `select id, first_name, last_name, department, last_login
       from users
       where role <> 'ADMIN' and status = 'ACTIVE'
         and office_location_id is null and can_check_in_from_anywhere = false`
    ),

    query(
      `select leave_type,
              coalesce(sum(remaining), 0)::float as remaining,
              coalesce(sum(used), 0)::float as used
       from leave_balances
       where year = extract(year from current_date)
       group by leave_type
       order by leave_type`
    ),

    query(
      `select l.id, l.leave_type, l.start_date, l.end_date, l.days_requested,
              u.first_name, u.last_name
       from leave_requests l join users u on u.id = l.user_id
       where l.status = 'APPROVED'
         and l.end_date >= current_date
         and l.start_date <= current_date + interval '14 days'
       order by l.start_date limit 8`
    ),

    query(
      `with mtd as (
         select a.user_id,
                sum(a.total_hours) as hours,
                sum(a.overtime_hours) as overtime
         from attendance a
         where a.date >= date_trunc('month', current_date)
         group by a.user_id
       )
       select
         coalesce(sum(u.salary), 0)::float as contracted_monthly,
         coalesce(sum(
           case when u.working_hours_per_day > 0 then
             ((coalesce(m.hours, 0) - coalesce(m.overtime, 0))
               * (u.salary / (u.working_hours_per_day * $1)))
             + (coalesce(m.overtime, 0)
               * (u.salary / (u.working_hours_per_day * $1)) * $2)
           else 0 end
         ), 0)::float as estimated_mtd
       from users u
       left join mtd m on m.user_id = u.id
       where u.status = 'ACTIVE'`,
      [AVG_WORKDAYS_PER_MONTH, OVERTIME_MULTIPLIER]
    ),
  ]);

  const neverLoggedIn = unassigned.rows.filter((r) => r.last_login === null).length;

  res.json({
    success: true,
    trend: rowsToCamel(trend.rows),
    byEmployee: rowsToCamel(byEmployee.rows),
    exceptions: {
      ...rowsToCamel(exceptions.rows)[0],
      staleOpenShifts: rowsToCamel(openShifts.rows),
      noOffice: rowsToCamel(unassigned.rows),
      neverLoggedIn,
    },
    leaveLiability: rowsToCamel(liability.rows),
    upcomingLeave: rowsToCamel(upcoming.rows),
    cost: rowsToCamel(cost.rows)[0],
  });
});

export const getActivity = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 12, 50);
  const activity = await AuditLog.findRecent({ limit });
  res.json({ success: true, activity });
});
