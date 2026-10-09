alter table public.threekend_teams
    add column if not exists kit_type text not null default 'bibs';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'threekend_teams_kit_type_valid'
          and conrelid = 'public.threekend_teams'::regclass
    ) then
        alter table public.threekend_teams
            add constraint threekend_teams_kit_type_valid
            check (kit_type in ('jersey', 'bibs'));
    end if;
end;
$$;

create or replace function public.threekend_create_session(
    p_public_code text,
    p_fixture_count integer,
    p_match_minutes integer,
    p_session_window_minutes integer,
    p_teams jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
    v_session_id uuid;
    v_team_count integer;
begin
    if coalesce(auth.role(), '') <> 'service_role' then
        raise exception 'not authorized' using errcode = '42501';
    end if;

    if jsonb_typeof(p_teams) <> 'array' or jsonb_array_length(p_teams) <> 3 then
        raise exception 'classic rotation requires exactly three teams' using errcode = '22023';
    end if;

    insert into public.threekend_sessions (
        public_code, fixture_count, match_minutes, session_window_minutes,
        clock_remaining_seconds
    ) values (
        p_public_code, p_fixture_count, p_match_minutes, p_session_window_minutes,
        p_match_minutes * 60
    ) returning id into v_session_id;

    insert into public.threekend_teams (
        session_id, team_key, label, bib_code, color_hex, kit_type
    )
    select v_session_id, team_key, label, bib_code, color_hex, coalesce(kit_type, 'bibs')
    from jsonb_to_recordset(p_teams) as team(
        team_key text,
        label text,
        bib_code text,
        color_hex text,
        kit_type text
    );

    get diagnostics v_team_count = row_count;
    if v_team_count <> 3 then
        raise exception 'classic rotation requires three valid teams' using errcode = '22023';
    end if;

    insert into public.threekend_session_events (session_id, event_type, actor_name, actor_role, details)
    values (
        v_session_id, 'session_created', 'Admin', 'admin',
        jsonb_build_object(
            'fixture_count', p_fixture_count,
            'match_minutes', p_match_minutes,
            'session_window_minutes', p_session_window_minutes
        )
    );

    return v_session_id;
end;
$$;
