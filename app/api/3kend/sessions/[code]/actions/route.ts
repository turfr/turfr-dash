import {
    ACCESS_COOKIE,
    ADMIN_COOKIE,
    errorResponse,
    getAdminSession,
    getSupabaseAdmin,
    hashToken,
    noStoreJson,
    normalizePublicCode,
    readCookie,
    validateSameOrigin,
} from "@/lib/3kend/server";

const ALLOWED_ACTIONS = ["start", "pause", "pause_injury", "pause_normal", "resume", "finish", "admin_advance", "finish_session", "cancel"] as const;
type MatchAction = (typeof ALLOWED_ACTIONS)[number];

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
    if (!validateSameOrigin(request)) return errorResponse("Request origin is not allowed.", 403);

    let body: { action?: unknown };
    try {
        body = await request.json();
    } catch {
        return errorResponse("Request body must be valid JSON.", 400);
    }
    if (typeof body.action !== "string" || !ALLOWED_ACTIONS.includes(body.action as MatchAction)) {
        return errorResponse("Choose a valid match action.", 400);
    }

    const { code: pathCode } = await context.params;
    const publicCode = normalizePublicCode(pathCode);
    if (!publicCode) return errorResponse("Session not found.", 404);

    try {
        const adminSession = await getAdminSession(request);
        const adminToken = adminSession ? readCookie(request, ADMIN_COOKIE) : null;
        const accessToken = readCookie(request, ACCESS_COOKIE);
        if (!adminToken && !accessToken) return errorResponse("Timekeeper access is required.", 401);

        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.rpc("threekend_apply_action", {
            p_public_code: publicCode,
            p_action: body.action,
            p_access_token_hash: accessToken ? hashToken(accessToken) : null,
            p_admin_token_hash: adminToken ? hashToken(adminToken) : null,
        });

        if (error) {
            if (error.code === "42501") return errorResponse("You are not authorized for this match action.", 403);
            if (error.code === "P0002") return errorResponse("Session or active invite was not found.", 404);
            if (error.code === "22023") return errorResponse(error.message, 409);
            throw error;
        }

        const result = data as { ok?: boolean; status?: string } | null;
        return noStoreJson({ ok: true, action: body.action, status: result?.status ?? null });
    } catch {
        return errorResponse("Could not apply the match action. Check the 3Kend migration and server configuration.", 503);
    }
}
