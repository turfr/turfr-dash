-- Let the session remain live after its planned window and let the active match run into overtime.
-- Match completion remains an explicit timekeeper action (or admin override).

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
        v_stoppage_type text;
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

        if p_action in ('admin_advance', 'cancel', 'finish_session') and not v_is_admin then
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
        elsif p_action in ('pause', 'pause_injury', 'pause_normal') then
            if v_session.status <> 'live' or v_session.clock_state <> 'running' then
                raise exception 'match clock is not running' using errcode = '22023';
            end if;

            v_elapsed := greatest(0, floor(extract(epoch from (v_now - v_session.clock_run_started_at)))::integer);
            if v_elapsed >= v_session.clock_remaining_seconds then
                raise exception 'match time has expired; finish the match instead' using errcode = '22023';
            end if;

            v_stoppage_type := case p_action
                when 'pause_injury' then 'injury'
                else 'normal'
            end;
            v_played := v_elapsed;
            v_remaining := v_session.clock_remaining_seconds - v_elapsed;
            update public.threekend_sessions
            set total_played_seconds = total_played_seconds + v_played,
                clock_state = 'stopped',
                clock_remaining_seconds = v_remaining,
                clock_run_started_at = null,
                version = version + 1,
                updated_at = v_now
            where id = v_session.id;
            v_event_type := 'match_paused';
            v_details := jsonb_build_object('remaining_seconds', v_remaining, 'stoppage_type', v_stoppage_type);
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

            v_played := v_elapsed;
            update public.threekend_sessions
            set total_played_seconds = total_played_seconds + v_played,
                current_fixture_number = current_fixture_number + 1,
                clock_state = 'ready',
                clock_remaining_seconds = match_minutes * 60,
                clock_run_started_at = null,
                version = version + 1,
                updated_at = v_now
            where id = v_session.id;
            v_event_type := 'match_completed';
            v_details := jsonb_build_object('completed_by_timekeeper', true, 'overtime_seconds', greatest(0, v_elapsed - v_session.clock_remaining_seconds));
        elsif p_action = 'admin_advance' then
            if v_session.current_fixture_number > v_session.fixture_count then
                raise exception 'no active fixture' using errcode = '22023';
            end if;

            if v_session.clock_state = 'running' then
                v_elapsed := greatest(0, floor(extract(epoch from (v_now - v_session.clock_run_started_at)))::integer);
                v_played := v_elapsed;
            else
                v_played := 0;
            end if;

            update public.threekend_sessions
            set total_played_seconds = total_played_seconds + v_played,
                current_fixture_number = current_fixture_number + 1,
                clock_state = 'ready',
                clock_remaining_seconds = match_minutes * 60,
                clock_run_started_at = null,
                version = version + 1,
                updated_at = v_now
            where id = v_session.id;
            v_event_type := 'admin_override';
            v_details := jsonb_build_object('action', 'advance_fixture', 'played_seconds_added', v_played);
        elsif p_action = 'finish_session' then
            if v_session.status <> 'live' then
                raise exception 'only a live session can be finished' using errcode = '22023';
            end if;

            if v_session.clock_state = 'running' then
                v_elapsed := greatest(0, floor(extract(epoch from (v_now - v_session.clock_run_started_at)))::integer);
                v_played := v_elapsed;
                v_remaining := greatest(0, v_session.clock_remaining_seconds - v_elapsed);
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
            v_event_type := 'session_completed';
            v_details := jsonb_build_object(
                'reason', 'admin_finished',
                'unfinished_fixture', case when v_session.current_fixture_number <= v_session.fixture_count then v_session.current_fixture_number else null end,
                'played_seconds_added', v_played,
                'remaining_match_seconds', v_remaining
            );
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
            case when v_is_admin and p_action in ('admin_advance', 'cancel', 'finish_session') then 'Admin' else v_actor_name end,
            case when v_is_admin and p_action in ('admin_advance', 'cancel', 'finish_session') then 'admin' else v_actor_role end,
            v_details, v_now
        );

        return jsonb_build_object('ok', true, 'action', p_action, 'version', v_session.version + 1);
    end;
    $$;

revoke all on function public.threekend_apply_action(text, text, text, text) from public, anon, authenticated;
grant execute on function public.threekend_apply_action(text, text, text, text) to service_role;
