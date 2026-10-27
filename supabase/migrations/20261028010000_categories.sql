-- Categoría por comercio, por usuario. Es la caché de la IA y también guarda
-- las correcciones del usuario, que siempre ganan.
create table public.merchant_categories (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  merchant_key text not null check (char_length(merchant_key) between 1 and 80),
  category text not null check (char_length(category) <= 40),
  source text not null check (source in ('user', 'ai', 'rule')),
  updated_at timestamptz not null default now(),
  primary key (user_id, merchant_key)
);

alter table public.merchant_categories enable row level security;

create policy "merchant_categories: solo el dueño" on public.merchant_categories
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Uso diario de la IA por usuario. El usuario puede leerlo, pero solo la
-- función de abajo lo incrementa: así nadie se reinicia su propio límite.
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  requests integer not null default 0 check (requests >= 0),
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

create policy "ai_usage: el dueño lee" on public.ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);

-- Reserva una llamada a la IA si queda cupo hoy (hora de Colombia).
create function public.consume_ai_quota(p_daily_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'America/Bogota')::date;
  used integer;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.ai_usage (user_id, day, requests)
  values (uid, today, 1)
  on conflict (user_id, day) do update
    set requests = public.ai_usage.requests + 1
    where public.ai_usage.requests < p_daily_limit
  returning requests into used;

  return used is not null;
end;
$$;

revoke execute on function public.consume_ai_quota from public, anon;
grant execute on function public.consume_ai_quota to authenticated;
