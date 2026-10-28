-- Métricas del producto, solo para el operador. Viven en un esquema que la
-- API no expone: se consultan desde el editor SQL de Supabase. Son conteos
-- agregados; no hay rastreo de páginas ni de comportamiento.
create schema if not exists analytics;
revoke all on schema analytics from public, anon, authenticated;

create view analytics.resumen as
select
  (select count(*) from auth.users) as usuarios,
  (select count(*) from auth.users where created_at > now() - interval '7 days') as nuevos_7_dias,
  (select count(*) from public.profiles where privacy_version is not null) as aceptaron_politica,
  (select count(*) from public.profiles where onboarded_at is not null) as completaron_onboarding,
  -- Activación: importó al menos un extracto.
  (select count(distinct user_id) from public.movements where source = 'statement') as activados,
  -- Retención aproximada: volvió a entrar 25 días o más después de registrarse.
  (select count(*) from auth.users where last_sign_in_at >= created_at + interval '25 days') as volvieron,
  (select count(*) from public.profiles where ai_categorization) as con_ia,
  (select count(*) from public.feedback) as comentarios,
  (select count(*) from public.feedback where created_at > now() - interval '7 days') as comentarios_7_dias;

create view analytics.por_semana as
select
  date_trunc('week', u.created_at)::date as semana,
  count(*) as registros,
  count(*) filter (where exists (
    select 1 from public.movements m where m.user_id = u.id and m.source = 'statement'
  )) as activados
from auth.users u
group by 1
order by 1 desc;

revoke all on all tables in schema analytics from public, anon, authenticated;
