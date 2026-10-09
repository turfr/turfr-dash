import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const ADMIN_COOKIE = "threekend_admin";
export const ACCESS_COOKIE = "threekend_access";
export function getSupabaseAdmin(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !secretKey) {
        throw new Error("3Kend backend is missing Supabase server configuration.");
    }

    return createClient(url, secretKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
        },
    });
}

export function createOpaqueToken(): string {
    return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

export function makeCookie(name: string, value: string, maxAgeSeconds: number): string {
    const attributes = [
        `${name}=${value}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Strict",
        `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
    ];

    if (process.env.NODE_ENV === "production") attributes.push("Secure");
    return attributes.join("; ");
}

export function readCookie(request: Request, name: string): string | null {
    const header = request.headers.get("cookie");
    if (!header) return null;

    const prefix = `${name}=`;
    const pair = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
    return pair ? decodeURIComponent(pair.slice(prefix.length)) : null;
}

export async function getAdminSession(request: Request) {
    const token = readCookie(request, ADMIN_COOKIE);
    if (!token) return null;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from("threekend_admin_sessions")
        .select("id, expires_at")
        .eq("token_hash", hashToken(token))
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

    if (error) throw error;
    return data;
}

export function adminRecoveryKeyMatches(candidate: string): boolean {
    const configured = process.env.THREEKEND_ADMIN_RECOVERY_KEY;
    if (!configured) return false;

    const expected = Buffer.from(configured);
    const actual = Buffer.from(candidate);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function errorResponse(message: string, status: number): Response {
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export function noStoreJson(body: unknown, init?: ResponseInit): Response {
    const headers = new Headers(init?.headers);
    headers.set("Cache-Control", "no-store");
    return Response.json(body, { ...init, headers });
}

export function normalizePublicCode(code: string): string | null {
    const normalized = code.trim().toUpperCase();
    return /^[A-Z0-9]{4,8}$/.test(normalized) ? normalized : null;
}

export function createPublicCode(): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const random = randomBytes(4);
    return Array.from(random, (byte) => alphabet[byte % alphabet.length]).join("");
}

export function getInviteBaseUrl(request: Request): string {
    const configured = process.env.NEXT_PUBLIC_SITE_URL;
    if (configured) return configured.replace(/\/$/, "");

    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl) return `https://${vercelUrl}`;

    return getRequestOrigin(request);
}

export function validateSameOrigin(request: Request): boolean {
    const originHeader = request.headers.get("origin");
    if (!originHeader) return false;

    try {
        const origin = new URL(originHeader).origin;
        const allowedOrigins = new Set([getRequestOrigin(request)]);
        const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
        if (configuredOrigin) allowedOrigins.add(new URL(configuredOrigin).origin);
        return allowedOrigins.has(origin);
    } catch {
        return false;
    }
}

function getRequestOrigin(request: Request): string {
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
    const host = forwardedHost || request.headers.get("host");
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
    const protocol = forwardedProtocol || new URL(request.url).protocol.slice(0, -1);

    if (host && (protocol === "http" || protocol === "https")) {
        return new URL(`${protocol}://${host}`).origin;
    }

    return new URL(request.url).origin;
}

export function minutesFromNow(minutes: number): string {
    return new Date(Date.now() + minutes * 60_000).toISOString();
}
