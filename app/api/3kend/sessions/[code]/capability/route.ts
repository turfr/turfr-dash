import { generateClassicRotation, type RotationTeam } from "@/lib/3kend/classic-rotation";
import {
    ACCESS_COOKIE,
    errorResponse,
    getAdminSession,
    getSupabaseAdmin,
    hashToken,
    noStoreJson,
    normalizePublicCode,
    readCookie,
} from "@/lib/3kend/server";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
    const { code: pathCode } = await context.params;
    const publicCode = normalizePublicCode(pathCode);
    if (!publicCode) return errorResponse("Session not found.", 404);

    try {
        const supabase = getSupabaseAdmin();
        const { data: session, error: sessionError } = await supabase
            .from("threekend_sessions")
            .select("id,status,fixture_count,current_fixture_number")
            .eq("public_code", publicCode)
            .maybeSingle();
        if (sessionError) throw sessionError;
        if (!session) return errorResponse("Session not found.", 404);

        const now = Date.now();
        const sessionEnded = session.status === "completed" || session.status === "cancelled";
        const adminSession = await getAdminSession(request);

        if (adminSession) {
            return noStoreJson({
                isAdmin: true,
                canControl: !sessionEnded,
                canSupervise: true,
                canFinishSession: !sessionEnded && session.status === "live",
                actorName: "Admin",
                role: "admin",
                reason: sessionEnded ? "session_ended" : null,
            });
        }

        const accessToken = readCookie(request, ACCESS_COOKIE);
        if (!accessToken) return noStoreJson({ isAdmin: false, canControl: false, canSupervise: false, canFinishSession: false, reason: "anonymous" });

        const { data: grant, error: grantError } = await supabase
            .from("threekend_access_grants")
            .select("id,invite_id")
            .eq("session_id", session.id)
            .eq("token_hash", hashToken(accessToken))
            .is("revoked_at", null)
            .gt("expires_at", new Date(now).toISOString())
            .maybeSingle();
        if (grantError) throw grantError;
        if (!grant) return noStoreJson({ isAdmin: false, canControl: false, canSupervise: false, canFinishSession: false, reason: "invalid_invite" });

        const { data: invite, error: inviteError } = await supabase
            .from("threekend_invites")
            .select("invitee_name,role,team_key,status,revoked_at,expires_at")
            .eq("id", grant.invite_id)
            .maybeSingle();
        if (inviteError) throw inviteError;
        if (!invite || invite.status !== "accepted" || invite.revoked_at || Date.parse(invite.expires_at) <= now) {
            return noStoreJson({ isAdmin: false, canControl: false, canSupervise: false, canFinishSession: false, reason: "invite_revoked" });
        }

        let assignedForCurrentFixture = invite.role === "session_timekeeper";
        if (invite.role === "team_timekeeper" && session.current_fixture_number <= session.fixture_count) {
            const { data: teamRows, error: teamsError } = await supabase
                .from("threekend_teams")
                .select("team_key,label,color_hex,bib_code,kit_type,kit_opacity")
                .eq("session_id", session.id)
                .order("team_key");
            if (teamsError) throw teamsError;

            if (!teamRows || teamRows.length !== 3) {
                throw new Error("Session team configuration is incomplete.");
            }

            const teams = (teamRows ?? []).map((team) => ({
                id: team.team_key,
                label: team.label,
                color: team.color_hex,
                bibCode: team.bib_code,
                kitType: team.kit_type,
                opacity: team.kit_opacity,
            })) as unknown as [RotationTeam, RotationTeam, RotationTeam];
            const fixture = generateClassicRotation(teams, session.fixture_count)[session.current_fixture_number - 1];
            assignedForCurrentFixture = fixture?.resting.id === invite.team_key;
        }

        const canControl = !sessionEnded && assignedForCurrentFixture;
        return noStoreJson({
            isAdmin: false,
            canControl,
            canSupervise: false,
            canFinishSession: false,
            actorName: invite.invitee_name,
            role: invite.role,
            teamKey: invite.team_key,
            reason: sessionEnded ? "session_ended" : canControl ? null : "not_designated_for_current_fixture",
        });
    } catch {
        return errorResponse("Could not check control access.", 503);
    }
}
