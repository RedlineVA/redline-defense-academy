-- Dedicated Redline Defense Academy Supabase project ONLY.
-- Never run this in Strike Force 1 Protection's database.
create extension if not exists pgcrypto;
create table if not exists public.rda_classes (
 id uuid primary key default gen_random_uuid(),
 title text not null,starts_at timestamptz not null,
 location text not null default '',
 capacity integer check(capacity is null or capacity between 1 and 1000),
 price_cents integer not null default 0 check(price_cents>=0),
 deposit_cents integer not null default 0 check(deposit_cents>=0 and deposit_cents<=price_cents),
 visible boolean not null default false,active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.rda_enrollments (
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null references public.rda_classes(id),
 full_name text not null,email text not null,phone text not null,
 notes text not null default '',
 status text not null default 'requested'
 check(status in ('requested','contacted','deposit_pending','confirmed','cancelled','attended')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists rda_enrollments_class_idx on public.rda_enrollments(class_id);
create table if not exists public.rda_payments (
 id uuid primary key default gen_random_uuid(),
 enrollment_id uuid not null references public.rda_enrollments(id),
 amount_cents integer not null check(amount_cents<>0),
 kind text not null check(kind in ('deposit','balance','refund')),
 method text not null check(method in ('cash','zelle','card_external','bank','other')),
 reference text not null default '',note text not null default '',
 created_at timestamptz not null default now(),
 constraint rda_payment_sign check((kind='refund' and amount_cents<0) or (kind<>'refund' and amount_cents>0))
);
create table if not exists public.rda_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table if not exists public.rda_request_throttle (
 ip_hash text not null,created_at timestamptz not null default now()
);
create index if not exists rda_request_throttle_idx on public.rda_request_throttle(ip_hash,created_at);
alter table public.rda_classes enable row level security;
alter table public.rda_enrollments enable row level security;
alter table public.rda_payments enable row level security;
alter table public.rda_admins enable row level security;
alter table public.rda_request_throttle enable row level security;
revoke all on public.rda_classes,public.rda_enrollments,public.rda_payments,public.rda_admins,public.rda_request_throttle from anon,authenticated;
create or replace function public.rda_submit_request(
 p_class_id uuid,p_name text,p_email text,p_phone text,p_notes text,p_ip_hash text
) returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid;
begin
 if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;
 if length(p_ip_hash)<>64 then raise exception 'Invalid request'; end if;
 perform pg_advisory_xact_lock(hashtext(p_ip_hash));
 if (select count(*) from public.rda_request_throttle where ip_hash=p_ip_hash and created_at>now()-interval '30 minutes')>=3 then
  raise exception 'Too many requests';
 end if;
 if not exists(select 1 from public.rda_classes where id=p_class_id and active and visible and starts_at>now()) then
  raise exception 'Class unavailable';
 end if;
 insert into public.rda_request_throttle(ip_hash) values(p_ip_hash);
 insert into public.rda_enrollments(class_id,full_name,email,phone,notes)
 values(p_class_id,p_name,p_email,p_phone,p_notes) returning id into new_id;
 return new_id;
end $$;
revoke all on function public.rda_submit_request(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.rda_submit_request(uuid,text,text,text,text,text) to service_role;
create or replace function public.rda_set_status(p_id uuid,p_status text)
 returns void language plpgsql security definer set search_path=public as $$
declare r record; filled integer;
begin
 if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;
 if p_status not in ('requested','contacted','deposit_pending','confirmed','cancelled','attended') then raise exception 'Invalid status';end if;
 select e.class_id,e.status,c.capacity into r from public.rda_enrollments e join public.rda_classes c on c.id=e.class_id where e.id=p_id;
 if not found then raise exception 'Request not found';end if;
 perform pg_advisory_xact_lock(hashtext(r.class_id::text));
 if p_status='confirmed' and r.status not in ('confirmed','attended') and r.capacity is not null then
  select count(*) into filled from public.rda_enrollments where class_id=r.class_id and status in ('confirmed','attended');
  if filled>=r.capacity then raise exception 'Class is full';end if;
 end if;
 update public.rda_enrollments set status=p_status,updated_at=now() where id=p_id;
end $$;
revoke all on function public.rda_set_status(uuid,text) from public,anon,authenticated;
grant execute on function public.rda_set_status(uuid,text) to service_role;
-- Create the initial staff user inside Supabase Authentication, verify email,
-- then grant access using a manually reviewed statement like:
-- insert into public.rda_admins(user_id) select id from auth.users where email='YOUR_ADMIN_EMAIL';
