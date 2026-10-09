import {
    ADMIN_COOKIE,
    adminRecoveryKeyMatches,
    createOpaqueToken,
    errorResponse,
    getAdminSession,
    getSupabaseAdmin,
    hashToken,
    makeCookie,
    noStoreJson,
    validateSameOrigin,
} from "@/lib/3kend/server";

const ADMIN_SESSION_SECONDS = 30 * 24 * 60 * 60;

export async function GET(request: Request) {
    try {
        const session = await getAdminSession(request);
        return noStoreJson({ isAdmin: Boolean(session) });
    } catch {
        return errorResponse("Admin access is temporarily unavailable.", 503);
    }
}

export async function POST(request: Request) {
    if (!validateSameOrigin(request)) return errorResponse("Request origin is not allowed.", 403);

    let body: { key?: unknown };
    try {
        body = await request.json();
    } catch {
        return errorResponse("Request body must be valid JSON.", 400);
    }

    if (typeof body.key !== "string" || body.key.length < 32) {
        return errorResponse("Enter the admin recovery key.", 400);
    }

    if (!process.env.THREEKEND_ADMIN_RECOVERY_KEY) {
        return errorResponse("Admin recovery is not configured on this deployment.", 503);
    }

    if (!adminRecoveryKeyMatches(body.key)) return errorResponse("Admin recovery key is not valid.", 401);

    try {
        const supabase = getSupabaseAdmin();
        const sessionToken = createOpaqueToken();
        const expiresAt = new Date(Date.now() + ADMIN_SESSION_SECONDS * 1000).toISOString();
        const { error } = await supabase.from("threekend_admin_sessions").insert({
            token_hash: hashToken(sessionToken),
            expires_at: expiresAt,
        });

        if (error) throw error;

        const response = noStoreJson({ ok: true });
        response.headers.append("Set-Cookie", makeCookie(ADMIN_COOKIE, sessionToken, ADMIN_SESSION_SECONDS));
        return response;
    } catch {
        return errorResponse("Could not create an admin session. Check the backend configuration.", 503);
    }
}
