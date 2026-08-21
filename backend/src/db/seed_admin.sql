-- Bootstrap the first ADMIN account.
-- Needed because /api/auth/register now requires an authenticated ADMIN caller,
-- so the very first admin has to be created directly in the database.
--
-- Login: admin@attendance.local / Admin@12345
-- The hash below is bcrypt("Admin@12345", 10 rounds). To use your own password,
-- generate a new hash first: node -e "console.log(require('bcryptjs').hashSync('yourPassword', 10))"
-- (run from backend/, where bcryptjs is installed) and swap it into $2 below.

insert into users (email, password, first_name, last_name, role, department, position, salary)
values (
  'admin@attendance.local',
  '$2a$10$nCwwPE3.HPUpoULIk/uPruCH/phOByXbO/en8gwmrzK9ft.PwA93y',
  'System',
  'Admin',
  'ADMIN',
  'Management',
  'Administrator',
  0
)
on conflict (email) do nothing;
