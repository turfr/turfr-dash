import {
    errorResponse,
    getAdminSession,
    getSupabaseAdmin,
    noStoreJson,
    normalizePublicCode,
    validateSameOrigin,
} from "@/lib/3kend/server";

export async function DELETE(request: Request, context: { params: Promise<{ code: string; inviteId: string }> }) {
    if (!validateSameOrigin(request)) return errorResponse("Request origin is not allowed.", 403);

    try {
        if (!(await getAdminSession(request))) return errorResponse("Admin access is required.", 401);
    } catch {
        return errorResponse("Admin access is temporarily unavailable.", 503);
    }

    const { code: pathCode, inviteId } = await context.params;
    const publicCode = normalizePublicCode(pathCode);
    if (!publicCode || !/^[0-9a-f-]{36}$/i.test(inviteId)) return errorResponse("Invite not found.", 404);

    try {
        const supabase = getSupabaseAdmin();
        const { data: invite, error: lookupError } = await supabase
            .from("threekend_invites")
            .select("id,session_id")
            .eq("id", inviteId)
            .maybeSingle();
        if (lookupError) throw lookupError;
        if (!invite) return errorResponse("Invite not found.", 404);

        const { data: session, error: sessionError } = await supabase
            .from("threekend_sessions")
            .select("id")
            .eq("id", invite.session_id)
            .eq("public_code", publicCode)
            .maybeSingle();
        if (sessionError) throw sessionError;
        if (!session) return errorResponse("Invite not found.", 404);

        const { error } = await supabase.rpc("threekend_revoke_invite", { p_invite_id: invite.id });
        if (error) throw error;
        return noStoreJson({ ok: true, inviteId: invite.id });
    } catch {
        return errorResponse("Could not revoke the invite.", 503);
    }
}
