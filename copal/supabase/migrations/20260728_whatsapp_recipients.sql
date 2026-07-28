begin;

create table if not exists public.whatsapp_recipients (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  phone_e164 text not null unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.management_settings (
  singleton boolean primary key default true check (singleton),
  default_whatsapp_recipient_id uuid references public.whatsapp_recipients(id),
  updated_at timestamptz not null default now()
);

insert into public.management_settings (singleton)
values (true)
on conflict (singleton) do nothing;

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where user_id = auth.uid()
      and active = true
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists whatsapp_recipients_touch_updated_at on public.whatsapp_recipients;
create trigger whatsapp_recipients_touch_updated_at
before update on public.whatsapp_recipients
for each row execute function public.touch_updated_at();

create or replace function public.create_whatsapp_recipient(
  p_display_name text,
  p_phone_e164 text,
  p_is_active boolean default true
)
returns public.whatsapp_recipients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient public.whatsapp_recipients;
  v_default_id uuid;
begin
  if not public.is_active_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if not coalesce(p_is_active, true) and
     not exists (select 1 from public.whatsapp_recipients) then
    raise exception 'The first recipient must be active';
  end if;

  insert into public.whatsapp_recipients (display_name, phone_e164, is_active)
  values (btrim(p_display_name), btrim(p_phone_e164), coalesce(p_is_active, true))
  returning * into v_recipient;

  select default_whatsapp_recipient_id
    into v_default_id
  from public.management_settings
  where singleton = true
  for update;

  if v_default_id is null then
    if not v_recipient.is_active then
      raise exception 'A default recipient must be active';
    end if;
    update public.management_settings
       set default_whatsapp_recipient_id = v_recipient.id,
           updated_at = now()
     where singleton = true;
  end if;

  return v_recipient;
end;
$$;

create or replace function public.set_default_whatsapp_recipient(p_recipient_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.whatsapp_recipients
    where id = p_recipient_id and is_active = true
  ) then
    raise exception 'Default recipient must exist and be active';
  end if;

  update public.management_settings
     set default_whatsapp_recipient_id = p_recipient_id,
         updated_at = now()
   where singleton = true;
end;
$$;

create or replace function public.update_whatsapp_recipient(
  p_id uuid,
  p_display_name text,
  p_phone_e164 text,
  p_is_active boolean
)
returns public.whatsapp_recipients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default_id uuid;
  v_recipient public.whatsapp_recipients;
begin
  if not public.is_active_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select default_whatsapp_recipient_id into v_default_id
  from public.management_settings
  where singleton = true
  for update;

  if p_id = v_default_id and not p_is_active then
    raise exception 'Select another default before deactivating this recipient';
  end if;

  update public.whatsapp_recipients
     set display_name = btrim(p_display_name),
         phone_e164 = btrim(p_phone_e164),
         is_active = p_is_active
   where id = p_id
   returning * into v_recipient;

  if v_recipient.id is null then
    raise exception 'Recipient not found';
  end if;

  return v_recipient;
end;
$$;

create or replace function public.delete_whatsapp_recipient(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default_id uuid;
begin
  if not public.is_active_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select default_whatsapp_recipient_id into v_default_id
  from public.management_settings
  where singleton = true
  for update;

  if p_id = v_default_id then
    raise exception 'Select another default before deleting this recipient';
  end if;

  delete from public.whatsapp_recipients where id = p_id;
end;
$$;

alter table public.whatsapp_recipients enable row level security;
alter table public.management_settings enable row level security;

drop policy if exists "Active admins read WhatsApp recipients" on public.whatsapp_recipients;
create policy "Active admins read WhatsApp recipients"
on public.whatsapp_recipients for select
to authenticated
using (public.is_active_admin());

drop policy if exists "Active admins read management settings" on public.management_settings;
create policy "Active admins read management settings"
on public.management_settings for select
to authenticated
using (public.is_active_admin());

revoke all on public.whatsapp_recipients from anon, authenticated;
revoke all on public.management_settings from anon, authenticated;
grant select on public.whatsapp_recipients to authenticated;
grant select on public.management_settings to authenticated;

revoke all on function public.create_whatsapp_recipient(text, text, boolean) from public;
revoke all on function public.update_whatsapp_recipient(uuid, text, text, boolean) from public;
revoke all on function public.set_default_whatsapp_recipient(uuid) from public;
revoke all on function public.delete_whatsapp_recipient(uuid) from public;
grant execute on function public.create_whatsapp_recipient(text, text, boolean) to authenticated;
grant execute on function public.update_whatsapp_recipient(uuid, text, text, boolean) to authenticated;
grant execute on function public.set_default_whatsapp_recipient(uuid) to authenticated;
grant execute on function public.delete_whatsapp_recipient(uuid) to authenticated;

commit;
