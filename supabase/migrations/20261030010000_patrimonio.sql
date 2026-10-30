-- Patrimonio bruto para el tope de renta (4.500 UVT al 31 de diciembre).
-- Saldos: el de cierre del último extracto importado, o el que escriba el
-- usuario. Bienes: lo que no sale en un extracto (inmuebles, vehículos…),
-- con un valor aproximado. Las deudas no se restan: el tope es sobre el
-- patrimonio bruto.

alter table public.own_accounts
  add column balance_cop bigint check (balance_cop >= 0),
  add column balance_on date;

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('real_estate', 'vehicle', 'investment', 'crypto', 'other')),
  label text check (char_length(label) <= 40),
  value_cop bigint not null check (value_cop > 0 and value_cop <= 100000000000),
  created_at timestamptz not null default now()
);

alter table public.assets enable row level security;

create policy "assets: solo el dueño" on public.assets
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create index assets_user_id_idx on public.assets (user_id);
