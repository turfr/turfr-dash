import { generateClassicRotation, type RotationTeam } from "@/lib/3kend/classic-rotation";
import { errorResponse, getSupabaseAdmin, noStoreJson, normalizePublicCode } from "@/lib/3kend/server";

type SessionRow = {
    id: string;
    public_code: string;
    mode: string;
    status: "waiting" | "live" | "completed" | "cancelled";
    fixture_count: number;
    match_minutes: number;
    session_window_minutes: number;
    schedule_version: string;
    current_fixture_number: number;
    clock_state: "ready" | "running" | "stopped";
    clock_remaining_seconds: number;
    clock_run_started_at: string | null;
    started_at: string | null;
    hard_ends_at: string | null;
    updated_at: string;
    version: number;
};

type TeamRow = {
    team_key: string;
    label: string;
    bib_code: string;
    color_hex: string;
    kit_type: "jersey" | "bibs";
    kit_opacity: number;
};

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
    const { code: pathCode } = await context.params;
    const publicCode = normalizePublicCode(pathCode);
    if (!publicCode) return errorResponse("Session not found.", 404);

    try {
        const supabase = getSupabaseAdmin();
        const { data: sessionData, error: sessionError } = await supabase
            .from("threekend_sessions")
            .select("id,public_code,mode,status,fixture_count,match_minutes,session_window_minutes,schedule_version,current_fixture_number,clock_state,clock_remaining_seconds,clock_run_started_at,started_at,hard_ends_at,updated_at,version")
            .eq("public_code", publicCode)
            .maybeSingle();

        if (sessionError) throw sessionError;
        if (!sessionData) return errorResponse("Session not found.", 404);
        const session = sessionData as SessionRow;

        const { data: teamData, error: teamsError } = await supabase
            .from("threekend_teams")
            .select("team_key,label,bib_code,color_hex,kit_type,kit_opacity")
            .eq("session_id", session.id)
            .order("team_key");

        if (teamsError) throw teamsError;
        const rows = (teamData ?? []) as TeamRow[];
        if (rows.length !== 3) throw new Error("Session team configuration is incomplete.");

        const teams = rows.map((team) => ({
            id: team.team_key,
            label: team.label,
            color: team.color_hex,
            bibCode: team.bib_code,
            kitType: team.kit_type,
            opacity: team.kit_opacity,
        })) as unknown as [RotationTeam, RotationTeam, RotationTeam];
        const fixtures = generateClassicRotation(teams, session.fixture_count);
        const now = Date.now();
        const runStartedAt = session.clock_run_started_at ? Date.parse(session.clock_run_started_at) : null;
        const elapsedSeconds = session.clock_state === "running" && runStartedAt !== null
            ? Math.max(0, Math.floor((now - runStartedAt) / 1000))
            : 0;
        const sessionCompleted = session.status === "completed" || session.status === "cancelled";
        const remainingSeconds = !currentFixtureNumberIsValid(session)
            ? 0
            : sessionCompleted
                ? session.clock_remaining_seconds
                : Math.max(0, session.clock_remaining_seconds - elapsedSeconds);
        const matchOvertimeSeconds = session.clock_state === "running" && runStartedAt !== null
            ? Math.max(0, elapsedSeconds - session.clock_remaining_seconds)
            : 0;
        const currentFixture = fixtures[session.current_fixture_number - 1] ?? null;
        let activeTimekeeper: { name: string } | null = null;
        if (currentFixture && (session.status === "waiting" || session.status === "live")) {
            const { data: invites, error: invitesError } = await supabase
                .from("threekend_invites")
                .select("invitee_name,role,team_key")
                .eq("session_id", session.id)
                .eq("status", "accepted")
                .is("revoked_at", null)
                .gt("expires_at", new Date(now).toISOString());
            if (invitesError) throw invitesError;

            const restingTeamKey = currentFixture.restingTeams[0]?.id;
            const assignedInvite = invites?.find((invite) =>
                invite.role === "team_timekeeper" && invite.team_key === restingTeamKey
            ) ?? invites?.find((invite) => invite.role === "session_timekeeper");
            if (assignedInvite && (assignedInvite.role === "team_timekeeper" || assignedInvite.role === "session_timekeeper")) {
                activeTimekeeper = { name: assignedInvite.invitee_name };
            }
        }
        let stoppageType: "injury" | "normal" | null = null;
        if (session.status === "live" && session.clock_state === "stopped") {
            const { data: lastPause, error: pauseError } = await supabase
                .from("threekend_session_events")
                .select("details")
                .eq("session_id", session.id)
                .eq("fixture_number", session.current_fixture_number)
                .eq("event_type", "match_paused")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            if (pauseError) throw pauseError;
            const details = lastPause?.details;
            const recordedType = details && typeof details === "object" && !Array.isArray(details)
                ? (details as Record<string, unknown>).stoppage_type
                : null;
            if (recordedType === "injury" || recordedType === "normal") {
                stoppageType = recordedType;
            }
        }

        return noStoreJson({
            session: {
                code: session.public_code,
                mode: session.mode,
                status: session.status,
                fixtureCount: session.fixture_count,
                matchMinutes: session.match_minutes,
                sessionWindowMinutes: session.session_window_minutes,
                plannedPlayMinutes: session.fixture_count * session.match_minutes,
                plannedBufferMinutes: session.session_window_minutes - session.fixture_count * session.match_minutes,
                currentFixtureNumber: session.current_fixture_number,
                clockState: sessionCompleted ? "stopped" : session.clock_state,
                remainingSeconds,
                matchOvertimeSeconds,
                stoppageType,
                startedAt: session.started_at,
                stoppedAt: session.status === "live" && session.clock_state === "stopped" ? session.updated_at : null,
                plannedEndsAt: session.hard_ends_at,
                endedAt: sessionCompleted ? session.updated_at : null,
                version: session.version,
            },
            teams,
            fixtures: fixtures.map((fixture) => ({
                number: fixture.matchNumber,
                cycle: fixture.cycleNumber,
                home: fixture.home,
                away: fixture.away,
                restingTeams: fixture.restingTeams,
            })),
            currentFixture: currentFixture ? {
                number: currentFixture.matchNumber,
                home: currentFixture.home,
                away: currentFixture.away,
                restingTeams: currentFixture.restingTeams,
            } : null,
            activeTimekeeper,
            serverNow: new Date(now).toISOString(),
        });
    } catch {
        return errorResponse("Could not load the session. Check the 3Kend migration and server configuration.", 503);
    }
}

function currentFixtureNumberIsValid(session: SessionRow): boolean {
    return session.current_fixture_number <= session.fixture_count;
}
