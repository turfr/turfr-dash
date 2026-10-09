-- These legacy tables are not used by the Turfr dashboard in this repository.
-- No client policies are added until an intentional access model is defined.
-- This denies direct PostgREST access for browser roles while preserving
-- privileged server-side service_role access.

alter table public.matches enable row level security;
alter table public.participation enable row level security;
alter table public.players enable row level security;

revoke all on table public.matches from public, anon, authenticated;
revoke all on table public.participation from public, anon, authenticated;
revoke all on table public.players from public, anon, authenticated;
