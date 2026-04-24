-- Ensure legacy super admins are recognized by shared admin checks.
update public.users
set is_admin = true
where is_super_admin = true
  and is_admin = false;
