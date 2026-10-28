-- Fechas de pago de la PILA y calendario de recordatorios.

-- La fecha límite de la PILA depende de los DOS últimos dígitos del documento.
alter table public.profiles
  add column id_last_two smallint check (id_last_two between 0 and 99),
  -- Token secreto del calendario suscribible (.ics): quien lo tenga ve las fechas, nada más.
  add column calendar_token uuid not null unique default gen_random_uuid();

-- Plazos de pago de aportes por PILA (Decreto 780 de 2016, art. 3.2.2.1,
-- sustituido por el Decreto 1990 de 2016). Los independientes pagan mes vencido.
create table public.pila_deadlines (
  digits_from smallint not null check (digits_from between 0 and 99),
  digits_to smallint not null check (digits_to between 0 and 99),
  business_day smallint not null check (business_day between 1 and 20),
  norm text not null,
  source_url text not null,
  verified_on date not null,
  primary key (digits_from),
  check (digits_from <= digits_to)
);

alter table public.pila_deadlines enable row level security;
create policy "pila_deadlines: lectura" on public.pila_deadlines for select to authenticated using (true);

insert into public.pila_deadlines (digits_from, digits_to, business_day, norm, source_url, verified_on)
select f, t, d, 'Decreto 1990 de 2016 (Decreto 780 de 2016, art. 3.2.2.1)',
  'https://normativa.colpensiones.gov.co/colpens/compilacion/docs/decreto_1990_2016.htm', date '2026-10-28'
from (values
  (0, 7, 2), (8, 14, 3), (15, 21, 4), (22, 28, 5), (29, 35, 6), (36, 42, 7), (43, 49, 8), (50, 56, 9),
  (57, 63, 10), (64, 69, 11), (70, 75, 12), (76, 81, 13), (82, 87, 14), (88, 93, 15), (94, 99, 16)
) as v(f, t, d);

-- El calendario .ics se pide sin sesión (lo descarga Google Calendar). Esta
-- función devuelve solo lo necesario para calcular las fechas de ese token.
create function public.calendar_for_token(p_token uuid)
returns table (id_last_two smallint, business_day smallint)
language sql
security definer
stable
set search_path = ''
as $$
  select p.id_last_two, d.business_day
  from public.profiles p
  join public.pila_deadlines d on p.id_last_two between d.digits_from and d.digits_to
  where p.calendar_token = p_token;
$$;

revoke execute on function public.calendar_for_token from public;
grant execute on function public.calendar_for_token to anon, authenticated;
