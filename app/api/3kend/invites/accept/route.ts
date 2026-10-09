import {
    ACCESS_COOKIE,
    createOpaqueToken,
    errorResponse,
    getSupabaseAdmin,
    hashToken,
    makeCookie,
    noStoreJson,
    validateSameOrigin,
} from "@/lib/3kend/server";

type AcceptInviteResult = {
    invite_id: string;
    session_id: string;
    public_code: string;
    invitee_name: string;
    role: "team_timekeeper" | "session_timekeeper";
    team_key: "A" | "B" | "C" | null;
    expires_at: string;
};

export async function POST(request: Request) {
    if (!validateSameOrigin(request)) return errorResponse("Request origin is not allowed.", 403);

    let body: { token?: unknown };
    try {
        body = await request.json();
    } catch {
        return errorResponse("Request body must be valid JSON.", 400);
    }

    if (typeof body.token !== "string" || body.token.length < 40 || body.token.length > 100) {
        return errorResponse("This invitation link is not valid.", 400);
    }

    try {
        const supabase = getSupabaseAdmin();
        const accessToken = createOpaqueToken();
        const { data, error } = await supabase.rpc("threekend_accept_invite", {
            p_invite_token_hash: hashToken(body.token),
            p_grant_token_hash: hashToken(accessToken),
        });

        if (error || !data) return errorResponse("This invitation is expired, revoked, or already accepted.", 410);

        const invite = data as AcceptInviteResult;
        const maxAge = Math.floor((Date.parse(invite.expires_at) - Date.now()) / 1000);
        if (maxAge <= 0) return errorResponse("This invitation has expired.", 410);

        const response = noStoreJson({
            ok: true,
            inviteeName: invite.invitee_name,
            role: invite.role,
            teamKey: invite.team_key,
            sessionCode: invite.public_code,
            expiresAt: invite.expires_at,
        });
        response.headers.append("Set-Cookie", makeCookie(ACCESS_COOKIE, accessToken, maxAge));
        response.headers.set("Referrer-Policy", "no-referrer");
        return response;
    } catch {
        return errorResponse("Could not accept this invitation. Check the 3Kend migration and server configuration.", 503);
    }
}
