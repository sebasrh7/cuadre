-- Ley 1581 de 2012: la autorización para tratar datos personales debe ser
-- previa y expresa, y debe poder probarse. Se guarda cuándo y qué versión de
-- la política aceptó el usuario.
alter table public.profiles
  add column privacy_accepted_at timestamptz,
  add column privacy_version text,
  -- Enviar nombres de comercio a Gemini es opcional y apagado por defecto.
  add column ai_categorization boolean not null default false;

-- Borra la cuenta del usuario que la llama. Todas las tablas con datos de
-- usuario referencian auth.users con `on delete cascade`, así que se borra todo.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_my_account from public, anon;
grant execute on function public.delete_my_account to authenticated;
