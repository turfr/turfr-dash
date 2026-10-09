    create extension if not exists pgcrypto with schema extensions;

    create table if not exists public.threekend_sessions (
        id uuid primary key default gen_random_uuid(),
        public_code text not null unique check (public_code ~ '^[A-Z0-9]{4,8}$'),
        mode text not null default 'classic_three_team_v1'
            check (mode = 'classic_three_team_v1'),
        status text not null default 'waiting'
            check (status in ('waiting', 'live', 'completed', 'cancelled')),
        fixture_count integer not null check (fixture_count >= 3 and fixture_count % 3 = 0),
        match_minutes integer not null check (match_minutes between 1 and 60),
        session_window_minutes integer not null,
        schedule_version text not null default 'classic_three_team_v1',
        current_fixture_number integer not null default 1,
        clock_state text not null default 'ready'
            check (clock_state in ('ready', 'running', 'stopped')),
        clock_remaining_seconds integer not null,
        clock_run_started_at timestamptz,
        total_played_seconds integer not null default 0,
        started_at timestamptz,
        hard_ends_at timestamptz,
        version integer not null default 1,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint threekend_session_window_covers_play
            check (session_window_minutes >= fixture_count * match_minutes),
        constraint threekend_current_fixture_valid
            check (current_fixture_number between 1 and fixture_count + 1),
        constraint threekend_clock_remaining_valid
            check (clock_remaining_seconds between 0 and match_minutes * 60),
        constraint threekend_running_has_anchor
            check ((clock_state = 'running') = (clock_run_started_at is not null)),
        constraint threekend_started_has_deadline
            check ((started_at is null) = (hard_ends_at is null))
    );

    create table if not exists public.threekend_teams (
        session_id uuid not null references public.threekend_sessions(id) on delete cascade,
        team_key text not null check (team_key in ('A', 'B', 'C')),
        label text not null,
        bib_code text not null,
        color_hex text not null check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
        created_at timestamptz not null default now(),
        primary key (session_id, team_key),
        unique (session_id, label),
        unique (session_id, bib_code)
    );

    create table if not exists public.threekend_invites (
        id uuid primary key default gen_random_uuid(),
        session_id uuid not null references public.threekend_sessions(id) on delete cascade,
        invitee_name text not null,
        whatsapp_phone text,
        role text not null check (role in ('team_timekeeper', 'session_timekeeper')),
        team_key text,
        token_hash text not null unique,
        status text not null default 'pending'
            check (status in ('pending', 'accepted', 'revoked')),
        expires_at timestamptz not null,
        accepted_at timestamptz,
        revoked_at timestamptz,
        created_at timestamptz not null default now(),
        constraint threekend_invite_role_team_valid check (
            (role = 'team_timekeeper' and team_key in ('A', 'B', 'C'))
            or (role = 'session_timekeeper' and team_key is null)
        ),
        foreign key (session_id, team_key)
            references public.threekend_teams(session_id, team_key)
            on delete cascade
    );

    create unique index if not exists threekend_one_active_team_invite
        on public.threekend_invites (session_id, team_key)
        where role = 'team_timekeeper' and status in ('pending', 'accepted');

    create unique index if not exists threekend_one_active_session_timekeeper_invite
        on public.threekend_invites (session_id)
        where role = 'session_timekeeper' and status in ('pending', 'accepted');

    create table if not exists public.threekend_access_grants (
        id uuid primary key default gen_random_uuid(),
        invite_id uuid not null unique references public.threekend_invites(id) on delete cascade,
        session_id uuid not null references public.threekend_sessions(id) on delete cascade,
        token_hash text not null unique,
        expires_at timestamptz not null,
        revoked_at timestamptz,
        created_at timestamptz not null default now()
    );

    create table if not exists public.threekend_admin_sessions (
        id uuid primary key default gen_random_uuid(),
        token_hash text not null unique,
        expires_at timestamptz not null,
        revoked_at timestamptz,
        created_at timestamptz not null default now()
    );

    create table if not exists public.threekend_session_events (
        id bigint generated always as identity primary key,
        session_id uuid not null references public.threekend_sessions(id) on delete cascade,
        fixture_number integer,
        event_type text not null check (event_type in (
            'session_created', 'invite_created', 'invite_accepted', 'invite_revoked',
            'match_started', 'match_paused', 'match_resumed', 'match_completed',
            'admin_override', 'session_completed', 'session_cancelled'
        )),
        actor_name text not null,
        actor_role text not null check (actor_role in ('admin', 'team_timekeeper', 'session_timekeeper', 'system')),
        details jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
    );

    create index if not exists threekend_invites_session_idx
        on public.threekend_invites (session_id, created_at desc);
    create index if not exists threekend_events_session_idx
        on public.threekend_session_events (session_id, id desc);
    create index if not exists threekend_access_session_idx
        on public.threekend_access_grants (session_id, expires_at)
        where revoked_at is null;

    alter table public.threekend_sessions enable row level security;
    alter table public.threekend_teams enable row level security;
    alter table public.threekend_invites enable row level security;
    alter table public.threekend_access_grants enable row level security;
    alter table public.threekend_admin_sessions enable row level security;
    alter table public.threekend_session_events enable row level security;

    drop policy if exists threekend_public_read_sessions on public.threekend_sessions;
    create policy threekend_public_read_sessions
        on public.threekend_sessions for select to anon, authenticated using (true);
    drop policy if exists threekend_public_read_teams on public.threekend_teams;
    create policy threekend_public_read_teams
        on public.threekend_teams for select to anon, authenticated using (true);

    revoke all on public.threekend_sessions from public, anon, authenticated;
    revoke all on public.threekend_teams from public, anon, authenticated;
    revoke all on public.threekend_invites from public, anon, authenticated;
    revoke all on public.threekend_access_grants from public, anon, authenticated;
    revoke all on public.threekend_admin_sessions from public, anon, authenticated;
    revoke all on public.threekend_session_events from public, anon, authenticated;

    grant all on public.threekend_sessions to service_role;
    grant all on public.threekend_teams to service_role;
    grant all on public.threekend_invites to service_role;
    grant all on public.threekend_access_grants to service_role;
    grant all on public.threekend_admin_sessions to service_role;
    grant all on public.threekend_session_events to service_role;
    grant usage, select on sequence public.threekend_session_events_id_seq to service_role;

    grant select on public.threekend_sessions to anon, authenticated;
    grant select on public.threekend_teams to anon, authenticated;

    do $$
    begin
        if not exists (
            select 1
            from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename = 'threekend_sessions'
        ) then
            alter publication supabase_realtime add table public.threekend_sessions;
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

        insert into public.threekend_teams (session_id, team_key, label, bib_code, color_hex)
        select v_session_id, team_key, label, bib_code, color_hex
        from jsonb_to_recordset(p_teams) as team(team_key text, label text, bib_code text, color_hex text);

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

    create or replace function public.threekend_replace_invite(
        p_session_id uuid,
        p_invitee_name text,
        p_whatsapp_phone text,
        p_role text,
        p_team_key text,
        p_token_hash text,
        p_expires_at timestamptz
    )
    returns uuid
    language plpgsql
    security definer
    set search_path = public, extensions, pg_temp
    as $$
    declare
        v_invite_id uuid;
        v_session_code text;
    begin
        if coalesce(auth.role(), '') <> 'service_role' then
            raise exception 'not authorized' using errcode = '42501';
        end if;

        select public_code into v_session_code
        from public.threekend_sessions
        where id = p_session_id and status in ('waiting', 'live')
        for update;

        if not found then
            raise exception 'session is not accepting invites' using errcode = '22023';
        end if;

        update public.threekend_invites
        set status = 'revoked', revoked_at = now()
        where session_id = p_session_id
          and role = p_role
          and team_key is not distinct from p_team_key
          and status in ('pending', 'accepted');

        update public.threekend_access_grants grant_row
        set revoked_at = coalesce(grant_row.revoked_at, now())
        from public.threekend_invites invite
        where invite.id = grant_row.invite_id
          and invite.session_id = p_session_id
          and invite.role = p_role
          and invite.team_key is not distinct from p_team_key
          and grant_row.revoked_at is null;

        insert into public.threekend_invites (
            session_id, invitee_name, whatsapp_phone, role, team_key,
            token_hash, expires_at
        ) values (
            p_session_id, p_invitee_name, p_whatsapp_phone, p_role, p_team_key,
            p_token_hash, p_expires_at
        ) returning id into v_invite_id;

        insert into public.threekend_session_events (session_id, event_type, actor_name, actor_role, details)
        values (
            p_session_id, 'invite_created', 'Admin', 'admin',
            jsonb_build_object('invite_id', v_invite_id, 'invitee_name', p_invitee_name, 'role', p_role, 'team_key', p_team_key)
        );

        return v_invite_id;
    end;
    $$;

    create or replace function public.threekend_accept_invite(
        p_invite_token_hash text,
        p_grant_token_hash text
    )
    returns jsonb
    language plpgsql
    security definer
    set search_path = public, extensions, pg_temp
    as $$
    declare
        v_invite public.threekend_invites%rowtype;
        v_code text;
    begin
        if coalesce(auth.role(), '') <> 'service_role' then
            raise exception 'not authorized' using errcode = '42501';
        end if;

        select * into v_invite
        from public.threekend_invites
        where token_hash = p_invite_token_hash
          and status = 'pending'
          and expires_at > now()
        for update;

        if not found then
            raise exception 'invite is invalid, expired, or already used' using errcode = 'P0002';
        end if;

        if not exists (
            select 1 from public.threekend_sessions
            where id = v_invite.session_id and status in ('waiting', 'live')
        ) then
            raise exception 'session is not accepting invite claims' using errcode = '22023';
        end if;

        update public.threekend_invites
        set status = 'accepted', accepted_at = now()
        where id = v_invite.id;

        insert into public.threekend_access_grants (invite_id, session_id, token_hash, expires_at)
        values (v_invite.id, v_invite.session_id, p_grant_token_hash, v_invite.expires_at);

        select public_code into v_code
        from public.threekend_sessions
        where id = v_invite.session_id;

        insert into public.threekend_session_events (session_id, event_type, actor_name, actor_role, details)
        values (
            v_invite.session_id, 'invite_accepted', v_invite.invitee_name, v_invite.role,
            jsonb_build_object('invite_id', v_invite.id, 'team_key', v_invite.team_key)
        );

        return jsonb_build_object(
            'invite_id', v_invite.id,
            'session_id', v_invite.session_id,
            'public_code', v_code,
            'invitee_name', v_invite.invitee_name,
            'role', v_invite.role,
            'team_key', v_invite.team_key,
            'expires_at', v_invite.expires_at
        );
    end;
    $$;

    create or replace function public.threekend_revoke_invite(p_invite_id uuid)
    returns void
    language plpgsql
    security definer
    set search_path = public, extensions, pg_temp
    as $$
    declare
        v_invite public.threekend_invites%rowtype;
    begin
        if coalesce(auth.role(), '') <> 'service_role' then
            raise exception 'not authorized' using errcode = '42501';
        end if;

        select * into v_invite from public.threekend_invites where id = p_invite_id for update;
        if not found then
            raise exception 'invite not found' using errcode = 'P0002';
        end if;

        update public.threekend_invites set status = 'revoked', revoked_at = now()
        where id = v_invite.id and status <> 'revoked';

        update public.threekend_access_grants set revoked_at = now()
        where invite_id = v_invite.id and revoked_at is null;

        insert into public.threekend_session_events (session_id, event_type, actor_name, actor_role, details)
        values (
            v_invite.session_id, 'invite_revoked', 'Admin', 'admin',
            jsonb_build_object('invite_id', v_invite.id, 'invitee_name', v_invite.invitee_name)
        );
    end;
    $$;

    create or replace function public.threekend_apply_action(
        p_public_code text,
        p_action text,
        p_access_token_hash text,
        p_admin_token_hash text
    )
    returns jsonb
    language plpgsql
    security definer
    set search_path = public, extensions, pg_temp
    as $$
    declare
        v_session public.threekend_sessions%rowtype;
        v_grant public.threekend_access_grants%rowtype;
        v_invite public.threekend_invites%rowtype;
        v_now timestamptz := clock_timestamp();
        v_actor_name text := 'Admin';
        v_actor_role text := 'admin';
        v_is_admin boolean := false;
        v_elapsed integer := 0;
        v_played integer := 0;
        v_remaining integer;
        v_event_type text;
        v_details jsonb := '{}'::jsonb;
    begin
        if coalesce(auth.role(), '') <> 'service_role' then
            raise exception 'not authorized' using errcode = '42501';
        end if;

        select * into v_session
        from public.threekend_sessions
        where public_code = p_public_code
        for update;

        if not found then
            raise exception 'session not found' using errcode = 'P0002';
        end if;

        if p_admin_token_hash is not null then
            select exists (
                select 1 from public.threekend_admin_sessions
                where token_hash = p_admin_token_hash
                  and revoked_at is null
                  and expires_at > v_now
            ) into v_is_admin;
        end if;

        if not v_is_admin and p_access_token_hash is not null then
            select grant_row.*
            into v_grant
            from public.threekend_access_grants grant_row
            join public.threekend_invites invite on invite.id = grant_row.invite_id
            where grant_row.token_hash = p_access_token_hash
              and grant_row.session_id = v_session.id
              and grant_row.revoked_at is null
              and grant_row.expires_at > v_now
              and invite.status = 'accepted'
              and invite.revoked_at is null
              and invite.expires_at > v_now
            for update of grant_row, invite;

            if found then
                select * into v_invite
                from public.threekend_invites
                where id = v_grant.invite_id;
                v_actor_name := v_invite.invitee_name;
                v_actor_role := v_invite.role;
                if v_invite.role = 'team_timekeeper' then
                    if v_session.current_fixture_number > v_session.fixture_count then
                        raise exception 'no active fixture' using errcode = '42501';
                    end if;
                if v_invite.team_key <> (
                    case ((v_session.current_fixture_number - 1) % 3)
                        when 0 then 'C'
                        when 1 then 'A'
                        else 'B'
                    end
                ) then
                        raise exception 'not the designated timekeeper for this fixture' using errcode = '42501';
                    end if;
                end if;
            end if;
        end if;

        if not v_is_admin and v_actor_role = 'admin' then
            raise exception 'control access required' using errcode = '42501';
        end if;

        if v_session.status in ('completed', 'cancelled') then
            raise exception 'session is no longer active' using errcode = '22023';
        end if;

        if v_session.status = 'live' and v_session.hard_ends_at <= v_now then
            if v_session.clock_state = 'running' and v_session.clock_run_started_at is not null then
                v_elapsed := greatest(0, floor(extract(epoch from (v_now - v_session.clock_run_started_at)))::integer);
                v_played := least(v_elapsed, v_session.clock_remaining_seconds);
                v_remaining := greatest(0, v_session.clock_remaining_seconds - v_played);
            else
                v_played := 0;
                v_remaining := v_session.clock_remaining_seconds;
            end if;

            update public.threekend_sessions
            set status = 'completed',
                clock_state = 'stopped',
                clock_remaining_seconds = v_remaining,
                clock_run_started_at = null,
                total_played_seconds = total_played_seconds + v_played,
                version = version + 1,
                updated_at = v_now
            where id = v_session.id;

            insert into public.threekend_session_events (session_id, fixture_number, event_type, actor_name, actor_role, details, created_at)
            values (
                v_session.id, v_session.current_fixture_number, 'session_completed', 'System', 'system',
                jsonb_build_object('reason', 'hard_end', 'remaining_match_seconds', v_remaining), v_now
            );

            return jsonb_build_object('ok', false, 'reason', 'hard_end', 'status', 'completed');
        end if;

        if p_action in ('admin_advance', 'cancel') and not v_is_admin then
            raise exception 'admin access required for this action' using errcode = '42501';
        end if;

        if p_action = 'start' then
            if v_session.clock_state <> 'ready' or v_session.current_fixture_number > v_session.fixture_count then
                raise exception 'fixture is not ready to start' using errcode = '22023';
            end if;

            if v_session.status = 'waiting' then
                update public.threekend_sessions
                set status = 'live',
                    started_at = v_now,
                    hard_ends_at = v_now + make_interval(mins => session_window_minutes),
                    clock_state = 'running',
                    clock_run_started_at = v_now,
                    version = version + 1,
                    updated_at = v_now
                where id = v_session.id;
            else
                update public.threekend_sessions
                set clock_state = 'running',
                    clock_run_started_at = v_now,
                    version = version + 1,
                    updated_at = v_now
                where id = v_session.id;
            end if;
            v_event_type := 'match_started';
        elsif p_action = 'pause' then
            if v_session.status <> 'live' or v_session.clock_state <> 'running' then
                raise exception 'match clock is not running' using errcode = '22023';
            end if;

            v_elapsed := greatest(0, floor(extract(epoch from (v_now - v_session.clock_run_started_at)))::integer);
            v_played := least(v_elapsed, v_session.clock_remaining_seconds);
            v_remaining := greatest(0, v_session.clock_remaining_seconds - v_played);

            if v_remaining = 0 then
                update public.threekend_sessions
                set total_played_seconds = total_played_seconds + v_played,
                    current_fixture_number = current_fixture_number + 1,
                    clock_state = 'ready',
                    clock_remaining_seconds = match_minutes * 60,
                    clock_run_started_at = null,
                    status = case when current_fixture_number = fixture_count then 'completed' else status end,
                    version = version + 1,
                    updated_at = v_now
                where id = v_session.id;
                v_event_type := 'match_completed';
                v_details := jsonb_build_object('completed_by_timer', true);
            else
                update public.threekend_sessions
                set total_played_seconds = total_played_seconds + v_played,
                    clock_state = 'stopped',
                    clock_remaining_seconds = v_remaining,
                    clock_run_started_at = null,
                    version = version + 1,
                    updated_at = v_now
                where id = v_session.id;
                v_event_type := 'match_paused';
                v_details := jsonb_build_object('remaining_seconds', v_remaining);
            end if;
        elsif p_action = 'resume' then
            if v_session.status <> 'live' or v_session.clock_state <> 'stopped' or v_session.clock_remaining_seconds <= 0 then
                raise exception 'match clock cannot be resumed' using errcode = '22023';
            end if;

            update public.threekend_sessions
            set clock_state = 'running',
                clock_run_started_at = v_now,
                version = version + 1,
                updated_at = v_now
            where id = v_session.id;
            v_event_type := 'match_resumed';
        elsif p_action = 'finish' then
            if v_session.status <> 'live' or v_session.clock_state <> 'running' then
                raise exception 'match clock is not running' using errcode = '22023';
            end if;

            v_elapsed := greatest(0, floor(extract(epoch from (v_now - v_session.clock_run_started_at)))::integer);
            if v_elapsed < v_session.clock_remaining_seconds then
                raise exception 'match time has not expired' using errcode = '22023';
            end if;

            v_played := v_session.clock_remaining_seconds;
            update public.threekend_sessions
            set total_played_seconds = total_played_seconds + v_played,
                current_fixture_number = current_fixture_number + 1,
                clock_state = 'ready',
                clock_remaining_seconds = match_minutes * 60,
                clock_run_started_at = null,
                status = case when current_fixture_number = fixture_count then 'completed' else status end,
                version = version + 1,
                updated_at = v_now
            where id = v_session.id;
            v_event_type := 'match_completed';
            v_details := jsonb_build_object('completed_by_timer', true);
        elsif p_action = 'admin_advance' then
            if v_session.current_fixture_number > v_session.fixture_count then
                raise exception 'no active fixture' using errcode = '22023';
            end if;

            if v_session.clock_state = 'running' then
                v_elapsed := greatest(0, floor(extract(epoch from (v_now - v_session.clock_run_started_at)))::integer);
                v_played := least(v_elapsed, v_session.clock_remaining_seconds);
            else
                v_played := 0;
            end if;

            update public.threekend_sessions
            set total_played_seconds = total_played_seconds + v_played,
                current_fixture_number = current_fixture_number + 1,
                clock_state = 'ready',
                clock_remaining_seconds = match_minutes * 60,
                clock_run_started_at = null,
                status = case when current_fixture_number = fixture_count then 'completed' else status end,
                version = version + 1,
                updated_at = v_now
            where id = v_session.id;
            v_event_type := 'admin_override';
            v_details := jsonb_build_object('action', 'advance_fixture', 'played_seconds_added', v_played);
        elsif p_action = 'cancel' then
            update public.threekend_sessions
            set status = 'cancelled',
                clock_state = 'stopped',
                clock_run_started_at = null,
                version = version + 1,
                updated_at = v_now
            where id = v_session.id;
            v_event_type := 'session_cancelled';
        else
            raise exception 'unsupported action' using errcode = '22023';
        end if;

        insert into public.threekend_session_events (session_id, fixture_number, event_type, actor_name, actor_role, details, created_at)
        values (
            v_session.id, v_session.current_fixture_number, v_event_type,
            case when v_is_admin and p_action in ('admin_advance', 'cancel') then 'Admin' else v_actor_name end,
            case when v_is_admin and p_action in ('admin_advance', 'cancel') then 'admin' else v_actor_role end,
            v_details, v_now
        );

        if p_action in ('finish', 'admin_advance', 'pause') and v_event_type = 'match_completed'
           and v_session.current_fixture_number = v_session.fixture_count then
            insert into public.threekend_session_events (session_id, fixture_number, event_type, actor_name, actor_role, details, created_at)
            values (v_session.id, v_session.current_fixture_number, 'session_completed', v_actor_name, v_actor_role, '{}'::jsonb, v_now);
        end if;

        return jsonb_build_object('ok', true, 'action', p_action, 'version', v_session.version + 1);
    end;
    $$;

    revoke all on function public.threekend_create_session(text, integer, integer, integer, jsonb) from public, anon, authenticated;
    revoke all on function public.threekend_replace_invite(uuid, text, text, text, text, text, timestamptz) from public, anon, authenticated;
    revoke all on function public.threekend_accept_invite(text, text) from public, anon, authenticated;
    revoke all on function public.threekend_revoke_invite(uuid) from public, anon, authenticated;
    revoke all on function public.threekend_apply_action(text, text, text, text) from public, anon, authenticated;
    grant execute on function public.threekend_create_session(text, integer, integer, integer, jsonb) to service_role;
    grant execute on function public.threekend_replace_invite(uuid, text, text, text, text, text, timestamptz) to service_role;
    grant execute on function public.threekend_accept_invite(text, text) to service_role;
    grant execute on function public.threekend_revoke_invite(uuid) to service_role;
    grant execute on function public.threekend_apply_action(text, text, text, text) to service_role;
