import { createClassicSessionPlan, type RotationTeam } from "@/lib/3kend/classic-rotation";
import {
    createPublicCode,
    errorResponse,
    getAdminSession,
    getSupabaseAdmin,
    noStoreJson,
    validateSameOrigin,
} from "@/lib/3kend/server";

type TeamInput = {
    key: "A" | "B" | "C";
    label: string;
    bibCode: string;
    colorHex: string;
    kitType?: "jersey" | "bibs";
    kitOpacity?: number;
};

type CreateSessionBody = {
    fixtureCount?: number;
    matchMinutes?: number;
    sessionWindowMinutes?: number;
    teams?: TeamInput[];
};

const TEAM_KEYS = ["A", "B", "C"] as const;

export async function POST(request: Request) {
    if (!validateSameOrigin(request)) return errorResponse("Request origin is not allowed.", 403);

    try {
        if (!(await getAdminSession(request))) return errorResponse("Admin access is required.", 401);
    } catch {
        return errorResponse("Admin access is temporarily unavailable.", 503);
    }

    let body: CreateSessionBody;
    try {
        body = await request.json();
    } catch {
        return errorResponse("Request body must be valid JSON.", 400);
    }

    const fixtureCount = body.fixtureCount ?? 12;
    const matchMinutes = body.matchMinutes ?? 8;
    const sessionWindowMinutes = body.sessionWindowMinutes ?? 120;
    const teams = body.teams;

    if (!Number.isInteger(fixtureCount) || fixtureCount < 3 || fixtureCount > 60 || fixtureCount % 3 !== 0) {
        return errorResponse("Classic Rotation fixture count must be a multiple of three, from 3 to 60.", 400);
    }
    if (!Number.isInteger(sessionWindowMinutes) || sessionWindowMinutes > 360) {
        return errorResponse("Session window must be a whole number of minutes, up to 360.", 400);
    }
    if (!Array.isArray(teams) || teams.length !== 3) {
        return errorResponse("Classic Rotation requires exactly three teams.", 400);
    }

    const validTeams = teams.every((team, index) =>
        team &&
        team.key === TEAM_KEYS[index] &&
        typeof team.label === "string" && team.label.trim().length > 0 && team.label.trim().length <= 40 &&
        typeof team.bibCode === "string" && team.bibCode.trim().length > 0 && team.bibCode.trim().length <= 40 &&
        (team.kitType === undefined || team.kitType === "jersey" || team.kitType === "bibs") &&
        (team.kitOpacity === undefined || (typeof team.kitOpacity === "number" && Number.isFinite(team.kitOpacity) && team.kitOpacity >= 0.4 && team.kitOpacity <= 1)) &&
        typeof team.colorHex === "string" && /^#[0-9A-Fa-f]{6}$/.test(team.colorHex),
    );
    if (!validTeams) return errorResponse("Enter teams A, B, and C with a kit style, bib color, and valid color value.", 400);

    const rotationTeams = teams.map((team) => ({
        id: team.key,
        label: team.label.trim(),
        color: team.colorHex,
    })) as [RotationTeam, RotationTeam, RotationTeam];

    let plan;
    try {
        plan = createClassicSessionPlan({
            teams: rotationTeams,
            fixtureCount,
            matchMinutes,
            sessionWindowMinutes,
        });
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : "Session settings are invalid.", 400);
    }

    try {
        const supabase = getSupabaseAdmin();
        const teamRows = teams.map((team) => ({
            team_key: team.key,
            label: team.label.trim(),
            bib_code: team.bibCode.trim(),
            color_hex: team.colorHex,
            kit_type: team.kitType ?? "bibs",
            kit_opacity: team.kitType === "bibs" ? team.kitOpacity ?? 1 : 1,
        }));

        let sessionId: string | null = null;
        let publicCode = "";
        for (let attempt = 0; attempt < 5; attempt += 1) {
            publicCode = createPublicCode();
            const { data, error } = await supabase.rpc("threekend_create_session", {
                p_public_code: publicCode,
                p_fixture_count: fixtureCount,
                p_match_minutes: matchMinutes,
                p_session_window_minutes: sessionWindowMinutes,
                p_teams: teamRows,
            });

            if (!error) {
                sessionId = data as string;
                break;
            }
            if (error.code !== "23505") throw error;
        }

        if (!sessionId) return errorResponse("Could not allocate a unique session code. Please retry.", 503);

        return noStoreJson({
            sessionId,
            publicCode,
            publicPath: `/3kend/${publicCode}`,
            mode: plan.mode,
            fixtureCount: plan.fixtureCount,
            matchMinutes: plan.matchMinutes,
            sessionWindowMinutes: plan.sessionWindowMinutes,
            plannedPlayMinutes: plan.plannedPlayMinutes,
            plannedBufferMinutes: plan.plannedBufferMinutes,
            fixtures: plan.fixtures.map((fixture) => ({
                number: fixture.matchNumber,
                home: fixture.home,
                away: fixture.away,
                restingTeams: fixture.restingTeams,
            })),
        }, { status: 201 });
    } catch {
        return errorResponse("Could not create the session. Check the 3Kend migration and server configuration.", 503);
    }
}
