"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { SevenSegmentClock } from "./SevenSegmentClock";
import { TeamKitIcon } from "./TeamKitIcon";
import styles from "./page.module.css";

type Team = {
    id: string;
    label: string;
    color: string;
    bibCode: string;
    kitType: "jersey" | "bibs";
};

type Fixture = {
    number: number;
    cycle: number;
    home: Team;
    away: Team;
    restingTeams: Team[];
};

type SessionSnapshot = {
    session: {
        code: string;
        mode: string;
        status: "waiting" | "live" | "completed" | "cancelled";
        fixtureCount: number;
        matchMinutes: number;
        sessionWindowMinutes: number;
        currentFixtureNumber: number;
        clockState: "ready" | "running" | "stopped";
        remainingSeconds: number;
        startedAt: string | null;
        hardEndsAt: string | null;
    };
    fixtures: Fixture[];
    currentFixture: Fixture | null;
    serverNow: string;
};

type Capability = {
    canControl: boolean;
    actorName?: string;
    reason?: string;
};

const ACTION_LABELS: Record<string, string> = {
    start: "START MATCH",
    pause: "PAUSE CLOCK",
    resume: "RESUME MATCH",
    finish: "COMPLETE MATCH",
};

function formatClock(seconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function SessionConsole({ code }: { code: string }) {
    const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
    const [capability, setCapability] = useState<Capability>({ canControl: false });
    const [sampledAt, setSampledAt] = useState(0);
    const [clockNow, setClockNow] = useState(0);
    const [loading, setLoading] = useState(true);
    const [browserOnline, setBrowserOnline] = useState(true);
    const [apiReachable, setApiReachable] = useState(true);
    const [realtimeEnabled, setRealtimeEnabled] = useState(false);
    const [realtimeConnected, setRealtimeConnected] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const refresh = useCallback(async () => {
        let sessionResponse: Response;
        let capabilityResponse: Response;
        try {
            [sessionResponse, capabilityResponse] = await Promise.all([
                fetch(`/api/3kend/sessions/${encodeURIComponent(code)}`, { cache: "no-store" }),
                fetch(`/api/3kend/sessions/${encodeURIComponent(code)}/capability`, { cache: "no-store" }),
            ]);
        } catch (reason) {
            setApiReachable(false);
            throw reason;
        }

        setApiReachable(true);
        const sessionBody = await sessionResponse.json();
        const capabilityBody = await capabilityResponse.json();
        if (!sessionResponse.ok) throw new Error(sessionBody.error ?? "Could not load this session.");
        if (!capabilityResponse.ok) throw new Error(capabilityBody.error ?? "Could not check control access.");

        setSnapshot(sessionBody as SessionSnapshot);
        setCapability(capabilityBody as Capability);
        const sample = performance.now();
        setSampledAt(sample);
        setClockNow(sample);
        setError("");
    }, [code]);

    useEffect(() => {
        let active = true;
        let client: SupabaseClient | null = null;
        let hadRealtimeConnection = false;

        const load = async () => {
            setSyncing(true);
            try {
                await refresh();
            } catch (reason) {
                if (active) setError(reason instanceof Error ? reason.message : "Could not load this session.");
            } finally {
                if (active) {
                    setLoading(false);
                    setSyncing(false);
                }
            }
        };

        const onOffline = () => setBrowserOnline(false);
        const onOnline = () => {
            setBrowserOnline(true);
            void load();
        };
        const onVisibilityChange = () => {
            if (!document.hidden && navigator.onLine) void load();
        };

        setBrowserOnline(navigator.onLine);
        void load();
        window.addEventListener("offline", onOffline);
        window.addEventListener("online", onOnline);
        document.addEventListener("visibilitychange", onVisibilityChange);
        const timer = window.setInterval(() => setClockNow(performance.now()), 250);

        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        setRealtimeEnabled(Boolean(url && publicKey));
        if (url && publicKey) {
            client = createClient(url, publicKey, {
                auth: { persistSession: false, autoRefreshToken: false },
            });
            const channel = client
                .channel(`3kend-session-${code}`)
                .on("postgres_changes", {
                    event: "UPDATE",
                    schema: "public",
                    table: "threekend_sessions",
                    filter: `public_code=eq.${code.toUpperCase()}`,
                }, () => { void load(); })
                .subscribe((status) => {
                    if (status === "SUBSCRIBED") {
                        const reconnected = hadRealtimeConnection;
                        hadRealtimeConnection = true;
                        setRealtimeConnected(true);
                        if (reconnected) void load();
                    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
                        setRealtimeConnected(false);
                    }
                });

            return () => {
                active = false;
                window.clearInterval(timer);
                window.removeEventListener("offline", onOffline);
                window.removeEventListener("online", onOnline);
                document.removeEventListener("visibilitychange", onVisibilityChange);
                void client?.removeChannel(channel);
            };
        }

        return () => {
            active = false;
            window.clearInterval(timer);
            window.removeEventListener("offline", onOffline);
            window.removeEventListener("online", onOnline);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [code, refresh]);

    const elapsed = sampledAt ? Math.floor((clockNow - sampledAt) / 1000) : 0;
    const matchSeconds = snapshot
        ? snapshot.session.remainingSeconds - (snapshot.session.clockState === "running" ? elapsed : 0)
        : 0;
    const masterSeconds = snapshot?.session.hardEndsAt
        ? Math.max(0, Math.floor((Date.parse(snapshot.session.hardEndsAt) - Date.parse(snapshot.serverNow) - (sampledAt ? clockNow - sampledAt : 0)) / 1000))
        : null;
    const isOffline = !browserOnline || !apiReachable;
    const isConnected = browserOnline && apiReachable && (!realtimeEnabled || realtimeConnected) && !syncing;
    const connectionNotice = realtimeEnabled && !realtimeConnected
            ? "RECONNECTING TO LIVE UPDATES"
            : syncing
                ? "SYNCING WITH SERVER"
                : null;

    const nextAction = snapshot?.session.status === "waiting"
        ? "start"
        : snapshot?.session.status === "live" && snapshot.session.clockState === "running"
            ? matchSeconds <= 0 ? "finish" : "pause"
            : snapshot?.session.status === "live" && snapshot.session.clockState === "stopped"
                ? "resume"
                : snapshot?.session.status === "live" && snapshot.session.clockState === "ready"
                    ? "start"
                    : null;

    const act = async () => {
        if (!nextAction || busy || !capability.canControl || !isConnected) return;
        setBusy(true);
        setMessage("");
        try {
            let response: Response;
            try {
                response = await fetch(`/api/3kend/sessions/${encodeURIComponent(code)}/actions`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: nextAction }),
                });
            } catch (reason) {
                setApiReachable(false);
                throw reason;
            }
            setApiReachable(true);
            const result = await response.json();
            if (!response.ok && response.status !== 409) throw new Error(result.error ?? "Action failed.");
            await refresh();
            if (response.ok) setMessage("STATE UPDATED");
        } catch (reason) {
            setMessage(reason instanceof Error ? reason.message : "Action failed.");
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return <main className={styles.screen}><div className={styles.frame}><p>LOADING SESSION…</p></div></main>;
    }

    if (!snapshot) {
        return <main className={styles.screen}><div className={styles.frame}><p role="alert">{error || "SESSION NOT FOUND"}</p></div></main>;
    }

    const { session, currentFixture, fixtures } = snapshot;
    const completed = session.status === "completed" || session.status === "cancelled";
    const masterLabel = session.status === "waiting" ? "NOT STARTED" : completed ? "SESSION ENDED" : "SESSION ENDS IN";
    const timekeeperName = capability.canControl ? capability.actorName : null;

    return (
        <main className={styles.screen}>
            <div className={styles.frame}>
                <header className={styles.header}>
                    <Image src="/3kend-mark.svg" alt="3Kend" width={135} height={56} priority className={styles.logo} />
                    <span className={styles.previewState}>{session.code}</span>
                </header>

                <section className={styles.sessionSummary} aria-label="Session summary">
                    <div className={styles.masterClock}>
                        <span>SESSION</span>
                        <strong>{masterSeconds === null ? "--:--" : formatClock(masterSeconds)}</strong>
                        <span className={styles.notStarted}>{masterLabel}</span>
                    </div>
                    <ol className={styles.progress} aria-label={`${session.fixtureCount} match rotation`}>
                        {fixtures.map((fixture, index) => {
                            const current = fixture.number === session.currentFixtureNumber && !completed;
                            const done = fixture.number < session.currentFixtureNumber || completed;
                            return (
                                <li key={fixture.number}
                                    className={current ? styles.currentMatch : done ? styles.completedMatch : styles.upcomingMatch}
                                    aria-current={current ? "step" : undefined}
                                    aria-label={`Match ${fixture.number}: ${fixture.home.label} versus ${fixture.away.label}`}>
                                    {String(index + 1).padStart(2, "0")}
                                </li>
                            );
                        })}
                    </ol>
                </section>

                <section className={styles.match} aria-label="Live 3Kend match">
                    <p className={styles.matchCount}>
                        {currentFixture ? `MATCH ${String(currentFixture.number).padStart(2, "0")}` : "SESSION COMPLETE"}
                        {currentFixture && <span> / {session.fixtureCount}</span>}
                    </p>

                    {currentFixture && <>
                        <div className={styles.teams}>
                            <TeamKitIcon teamKey={currentFixture.home.id} label={currentFixture.home.label}
                                color={currentFixture.home.color} kitType={currentFixture.home.kitType} bibCode={currentFixture.home.bibCode} />
                            <span className={styles.versus}>VS</span>
                            <TeamKitIcon teamKey={currentFixture.away.id} label={currentFixture.away.label}
                                color={currentFixture.away.color} kitType={currentFixture.away.kitType} bibCode={currentFixture.away.bibCode} />
                        </div>
                        <SevenSegmentClock value={formatClock(matchSeconds)} label={`${formatClock(matchSeconds)} playing time remaining`} />
                        {isOffline ? (
                            <p className={`${styles.connectionNotice} ${styles.offlineText}`} role="alert" aria-live="assertive">
                                <strong>OFFLINE · CLOCK IS AN ESTIMATE</strong>
                                <span>CHECK YOUR CONNECTION · CAN’T RECONNECT? CONTACT ADMIN</span>
                            </p>
                        ) : connectionNotice && (
                            <p className={styles.connectionNotice} role="status" aria-live="polite">{connectionNotice}</p>
                        )}
                        <p className={styles.clockCaption}>PLAYING TIME</p>
                        <p className={styles.timekeeper}>
                            <span className={styles.timekeeperDot} />
                            TIMEKEEPER <strong>{timekeeperName ?? "—"}</strong>
                        </p>
                    </>}

                    <div className={styles.actionArea}>
                        {nextAction && capability.canControl ? (
                            <button className={styles.control} type="button" onClick={act} disabled={busy || !isConnected}>
                                {busy ? "UPDATING…" : !isConnected ? "CONTROL UNAVAILABLE" : ACTION_LABELS[nextAction]}
                            </button>
                        ) : <p className={styles.readOnly}>
                            {completed ? "SESSION COMPLETE" : capability.canControl ? "NO ACTIVE MATCH" : "PUBLIC LIVE VIEW"}
                        </p>}
                        {(message || error) && <p className={styles.statusMessage} role="status">{message || error}</p>}
                    </div>
                </section>

                <footer className={styles.brandFooter} aria-label="Powered by Turfr">
                    <span>POWERED BY</span>
                    <Image src="/turfr-logo-white.svg" alt="Turfr logo" width={70} height={22} className={styles.poweredLogo} />
                </footer>
            </div>
        </main>
    );
}
