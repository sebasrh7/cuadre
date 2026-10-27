-- Esquema inicial de Cuadre (semana 1).
-- Regla: toda tabla con datos de usuario tiene RLS y solo el dueño la ve.
-- Dinero siempre en enteros: COP en pesos, monedas extranjeras en centavos.

-- ---------------------------------------------------------------------------
-- Perfil
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  worker_type text check (worker_type in ('employee_contractor', 'freelancer', 'other')),
  arl_risk smallint check (arl_risk between 1 and 5),
  -- Último dígito del NIT/cédula: define las fechas de vencimiento de la DIAN.
  nit_last_digit smallint check (nit_last_digit between 0 and 9),
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

-- Crea el perfil vacío al registrarse.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Identidad propia: sirve para detectar transferencias entre cuentas propias
-- ---------------------------------------------------------------------------

create table public.own_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  institution text not null check (institution in ('bancolombia', 'nequi', 'nu', 'other')),
  kind text not null check (kind in ('savings', 'checking', 'credit_card', 'debit_card', 'wallet')),
  -- Nunca se guarda el número completo.
  last4 text not null check (last4 ~ '^\d{4}$'),
  label text check (char_length(label) <= 40),
  created_at timestamptz not null default now(),
  unique (user_id, institution, kind, last4)
);

create table public.own_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- `key`: llave Bre-B / celular con la que recibe; `name`: como aparece su nombre en las alertas.
  kind text not null check (kind in ('key', 'name')),
  value text not null check (char_length(value) between 1 and 80),
  created_at timestamptz not null default now()
);

create unique index own_aliases_unique on public.own_aliases (user_id, kind, lower(value));

-- Guarda el onboarding en una sola transacción. `security invoker`: corre
-- con los permisos del usuario, así que RLS sigue aplicando.
create function public.save_onboarding(
  p_worker_type text,
  p_arl_risk smallint,
  p_nit_last_digit smallint,
  p_accounts jsonb, -- [{ "institution", "kind", "last4" }]
  p_aliases jsonb   -- [{ "kind", "value" }]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  update public.profiles
     set worker_type = p_worker_type,
         arl_risk = p_arl_risk,
         nit_last_digit = p_nit_last_digit,
         onboarded_at = coalesce(onboarded_at, now())
   where id = uid;

  delete from public.own_accounts where user_id = uid;
  insert into public.own_accounts (institution, kind, last4)
  select a->>'institution', a->>'kind', a->>'last4'
    from jsonb_array_elements(p_accounts) a;

  delete from public.own_aliases where user_id = uid;
  insert into public.own_aliases (kind, value)
  select a->>'kind', a->>'value'
    from jsonb_array_elements(p_aliases) a;
end;
$$;

revoke execute on function public.save_onboarding from public, anon;
grant execute on function public.save_onboarding to authenticated;

-- ---------------------------------------------------------------------------
-- Movimientos
-- ---------------------------------------------------------------------------

create table public.movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  occurred_on date not null,
  occurred_at_time time,
  amount_cop bigint not null check (amount_cop > 0),
  direction text not null check (direction in ('in', 'out')),
  kind text not null check (kind in ('income', 'expense', 'own_transfer')),
  counterparty text check (char_length(counterparty) <= 120),
  account_last4 text check (account_last4 ~ '^\d{4}$'),
  category text check (char_length(category) <= 40),
  source text not null check (source in ('statement', 'alert', 'dian_xml', 'manual')),
  -- Evita importar dos veces el mismo movimiento desde la misma fuente.
  dedupe_hash text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, dedupe_hash),
  check (kind <> 'income' or direction = 'in'),
  check (kind <> 'expense' or direction = 'out')
);

create index movements_user_date on public.movements (user_id, occurred_on desc);

-- ---------------------------------------------------------------------------
-- Ingresos en moneda extranjera
-- ---------------------------------------------------------------------------

create table public.foreign_incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Abono en COP con el que se concilió; null mientras no llegue el extracto.
  movement_id uuid unique,
  received_on date not null,
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  payer text check (char_length(payer) <= 120),
  created_at timestamptz not null default now(),
  -- El movimiento enlazado debe ser del mismo usuario.
  foreign key (movement_id, user_id) references public.movements (id, user_id) on delete set null (movement_id)
);

create index foreign_incomes_user_date on public.foreign_incomes (user_id, received_on desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.own_accounts enable row level security;
alter table public.own_aliases enable row level security;
alter table public.movements enable row level security;
alter table public.foreign_incomes enable row level security;

-- El perfil lo crea el trigger y se borra en cascada con el usuario.
create policy "profiles: el dueño lee" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: el dueño edita" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "own_accounts: solo el dueño" on public.own_accounts
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own_aliases: solo el dueño" on public.own_aliases
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "movements: solo el dueño" on public.movements
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "foreign_incomes: solo el dueño" on public.foreign_incomes
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
