-- Facturas electrónicas de la DIAN que sube el usuario (ZIP o XML). Se leen
-- en el navegador y aquí solo llega lo mínimo: quién vendió, el número, la
-- fecha, el total y el CUFE (con él se consulta la factura en la DIAN, así
-- que no hace falta guardar el XML ni el PDF). Del comprador no se guarda nada.
--
-- La factura no crea movimientos ni cambia ningún cálculo: se enlaza con el
-- gasto que la pagó (mismo valor, fechas cercanas) y le sirve de soporte.

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Código único de la factura (CUFE/CUDE). Evita guardar dos veces la misma.
  cufe text not null check (cufe ~ '^[0-9a-f]{40,128}$'),
  number text not null check (char_length(number) between 1 and 40),
  issued_on date not null,
  issuer_nit text not null check (issuer_nit ~ '^\d{5,15}$'),
  issuer_name text not null check (char_length(issuer_name) between 1 and 120),
  total_cop bigint not null check (total_cop > 0),
  -- Gasto que la pagó; null mientras no aparezca en un extracto o una alerta.
  movement_id uuid unique,
  created_at timestamptz not null default now(),
  unique (user_id, cufe),
  -- El gasto enlazado debe ser del mismo usuario. Si se borra (por ejemplo, la
  -- alerta que el extracto reemplaza), la factura queda sin enlazar.
  foreign key (movement_id, user_id) references public.movements (id, user_id) on delete set null (movement_id)
);

alter table public.invoices enable row level security;

create policy "invoices: solo el dueño" on public.invoices
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create index invoices_user_date on public.invoices (user_id, issued_on desc);
