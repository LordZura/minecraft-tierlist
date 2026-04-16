# Supabase auth setup (username + password only)

This app intentionally uses username/password only in the UI and maps usernames to internal emails:

- `username -> username@mcpvp.com`
- no email field shown to users
- no email verification step for users

## 1) Required environment variables (hosting)

Add these variables to your deployment platform (Netlify/Vercel):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

`SUPABASE_SERVICE_ROLE_KEY` is required by `POST /api/auth/register`.

## 2) Supabase dashboard settings

In **Supabase Dashboard → Authentication → Providers → Email**:

- Turn **Confirm email** OFF (recommended for this private project)

In **Supabase Dashboard → Authentication → Rate Limits**:

- Increase **Signups / hour / IP** if your group shares one IP or you are rapidly testing

If you keep seeing `POST /auth/v1/signup 429`, your browser is still running an old frontend bundle that calls client-side signup. Redeploy and hard refresh.

## 3) Optional SQL to keep `public.users` synced from Auth users

Run in SQL Editor if you want profile rows auto-created from `auth.users`:

```sql
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();
```
