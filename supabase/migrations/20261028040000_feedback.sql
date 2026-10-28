-- Comentarios de los usuarios desde la app. El operador los lee en Supabase.
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  message text not null check (char_length(message) between 1 and 2000),
  page text check (char_length(page) <= 200),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "feedback: el dueño crea" on public.feedback
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "feedback: el dueño lee" on public.feedback
  for select to authenticated using ((select auth.uid()) = user_id);
