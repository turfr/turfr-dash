import {
    createOpaqueToken,
    errorResponse,
    getAdminSession,
    getInviteBaseUrl,
    getSupabaseAdmin,
    hashToken,
    minutesFromNow,
    noStoreJson,
    normalizePublicCode,
    validateSameOrigin,
} from "@/lib/3kend/server";

type InviteBody = {
    inviteeName?: unknown;
    whatsappPhone?: unknown;
    role?: unknown;
    teamKey?: unknown;
    expiresInDays?: unknown;
};

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
    try {
        if (!(await getAdminSession(request))) return errorResponse("Admin access is required.", 401);
        const { code: pathCode } = await context.params;
        const publicCode = normalizePublicCode(pathCode);
        if (!publicCode) return errorResponse("Session not found.", 404);

        const supabase = getSupabaseAdmin();
        const { data: session, error: sessionError } = await supabase
            .from("threekend_sessions")
            .select("id")
            .eq("public_code", publicCode)
            .maybeSingle();
        if (sessionError) throw sessionError;
        if (!session) return errorResponse("Session not found.", 404);

        const { data, error } = await supabase
            .from("threekend_invites")
            .select("id,invitee_name,role,team_key,status,expires_at,accepted_at,revoked_at,created_at")
            .eq("session_id", session.id)
            .order("created_at", { ascending: false });
        if (error) throw error;

        const now = Date.now();
        return noStoreJson({ invites: (data ?? []).map((invite) => ({
            ...invite,
            status: invite.status === "pending" && Date.parse(invite.expires_at) <= now ? "expired" : invite.status,
        })) });
    } catch {
        return errorResponse("Could not load invite status.", 503);
    }
}

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
    if (!validateSameOrigin(request)) return errorResponse("Request origin is not allowed.", 403);

    try {
        if (!(await getAdminSession(request))) return errorResponse("Admin access is required.", 401);
    } catch {
        return errorResponse("Admin access is temporarily unavailable.", 503);
    }

    const { code: pathCode } = await context.params;
    const publicCode = normalizePublicCode(pathCode);
    if (!publicCode) return errorResponse("Session not found.", 404);

    let body: InviteBody;
    try {
        body = await request.json();
    } catch {
        return errorResponse("Request body must be valid JSON.", 400);
    }

    if (typeof body.inviteeName !== "string" || !body.inviteeName.trim() || body.inviteeName.trim().length > 80) {
        return errorResponse("Enter the invitee's name.", 400);
    }
    if (body.role !== "team_timekeeper" && body.role !== "session_timekeeper") {
        return errorResponse("Choose a valid timekeeper role.", 400);
    }

    const teamKey = body.role === "team_timekeeper" ? body.teamKey : null;
    if (body.role === "team_timekeeper" && !["A", "B", "C"].includes(String(teamKey))) {
        return errorResponse("Choose the team this timekeeper represents.", 400);
    }
    if (body.role === "session_timekeeper" && body.teamKey !== undefined && body.teamKey !== null) {
        return errorResponse("A session-wide timekeeper is not assigned to one team.", 400);
    }
    if (body.whatsappPhone !== undefined && body.whatsappPhone !== null &&
        (typeof body.whatsappPhone !== "string" || body.whatsappPhone.trim().length > 40)) {
        return errorResponse("Enter a valid WhatsApp number or leave it blank.", 400);
    }

    const expiresInDays = body.expiresInDays ?? 30;
    if (!Number.isInteger(expiresInDays) || Number(expiresInDays) < 1 || Number(expiresInDays) > 30) {
        return errorResponse("Invite expiry must be between 1 and 30 days.", 400);
    }

    try {
        const supabase = getSupabaseAdmin();
        const { data: session, error: sessionError } = await supabase
            .from("threekend_sessions")
            .select("id,status")
            .eq("public_code", publicCode)
            .maybeSingle();
        if (sessionError) throw sessionError;
        if (!session) return errorResponse("Session not found.", 404);
        if (session.status !== "waiting" && session.status !== "live") {
            return errorResponse("This session can no longer accept timekeeper invites.", 409);
        }

        const inviteToken = createOpaqueToken();
        const expiresAt = minutesFromNow(Number(expiresInDays) * 24 * 60);
        const { data: inviteId, error } = await supabase.rpc("threekend_replace_invite", {
            p_session_id: session.id,
            p_invitee_name: body.inviteeName.trim(),
            p_whatsapp_phone: typeof body.whatsappPhone === "string" ? body.whatsappPhone.trim() || null : null,
            p_role: body.role,
            p_team_key: teamKey,
            p_token_hash: hashToken(inviteToken),
            p_expires_at: expiresAt,
        });
        if (error) throw error;

        return noStoreJson({
            inviteId,
            inviteUrl: `${getInviteBaseUrl(request)}/3kend/invite/${inviteToken}`,
            expiresAt,
            replacesPreviousInvite: true,
        }, { status: 201 });
    } catch {
        return errorResponse("Could not create the invite. Check the 3Kend migration and server configuration.", 503);
    }
}
