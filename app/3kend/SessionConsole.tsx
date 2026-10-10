"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { SevenSegmentClock } from "./SevenSegmentClock";
import { TeamKitIcon } from "./TeamKitIcon";
import styles from "./page.module.css";

type Team = {
    id: string;
    label: string;
    color: string;
    bibCode: string;
    kitType: "jersey" | "bibs";
    opacity: number;
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
        matchOvertimeSeconds: number;
        startedAt: string | null;
        stoppedAt: string | null;
        stoppageType: "injury" | "normal" | null;
        plannedEndsAt: string | null;
        endedAt: string | null;
    };
    fixtures: Fixture[];
    currentFixture: Fixture | null;
    activeTimekeeper: { name: string } | null;
    serverNow: string;
};

type Capability = {
    canControl: boolean;
    canFinishSession?: boolean;
    isAdmin?: boolean;
    role?: "admin" | "team_timekeeper" | "session_timekeeper";
    actorName?: string;
    reason?: string;
};

type OptimisticPause = {
    remainingSeconds: number;
    overtimeSeconds: number;
    pausedAtPerformance: number;
    stoppageType: "injury" | "normal";
};

const ACTION_LABELS: Record<string, string> = {
    start: "START",
    resume: "RESUME",
    finish: "END",
};

function formatClock(seconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function MedicalIcon() {
    return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true" focusable="false">
        <path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7" stroke="currentColor" strokeWidth="1.7" />
        <rect x="3" y="7" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M11 10h2v2h2v2h-2v2h-2v-2H9v-2h2z" fill="currentColor" />
    </svg>;
}

function PauseIcon() {
    return <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true" focusable="false">
        <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
    </svg>;
}

function UserIcon() {
    return <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true" focusable="false">
        <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M3 14c.35-2.35 2.25-3.7 5-3.7s4.65 1.35 5 3.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>;
}

export function SessionConsole({ code }: { code: string }) {
    const finishDialogRef = useRef<HTMLDialogElement>(null);
    const refreshRequestId = useRef(0);
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
    const [finishDialogOpen, setFinishDialogOpen] = useState(false);
    const [optimisticPause, setOptimisticPause] = useState<OptimisticPause | null>(null);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        const dialog = finishDialogRef.current;
        if (!dialog) return;
        if (finishDialogOpen && !dialog.open) dialog.showModal();
        if (!finishDialogOpen && dialog.open) dialog.close();
    }, [finishDialogOpen]);

    const refresh = useCallback(async () => {
        const requestId = ++refreshRequestId.current;
        let sessionResponse: Response;
        let capabilityResponse: Response;
        try {
            [sessionResponse, capabilityResponse] = await Promise.all([
                fetch(`/api/3kend/sessions/${encodeURIComponent(code)}`, { cache: "no-store" }),
                fetch(`/api/3kend/sessions/${encodeURIComponent(code)}/capability`, { cache: "no-store" }),
            ]);
        } catch (reason) {
            if (requestId !== refreshRequestId.current) return;
            setApiReachable(false);
            throw reason;
        }

        const sessionBody = await sessionResponse.json();
        const capabilityBody = await capabilityResponse.json();
        // Realtime, polling, and action completion can overlap. Only the most
        // recently requested snapshot may replace the session and its access.
        if (requestId !== refreshRequestId.current) return;
        setApiReachable(true);
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
        let quietRefreshInFlight = false;

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

        const pollSessionState = async () => {
            if (!active || document.hidden || !navigator.onLine || quietRefreshInFlight) return;
            quietRefreshInFlight = true;
            try {
                await refresh();
            } catch (reason) {
                if (active) setError(reason instanceof Error ? reason.message : "Could not refresh this session.");
            } finally {
                quietRefreshInFlight = false;
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
        const stateRefreshTimer = window.setInterval(() => { void pollSessionState(); }, 3000);

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
                window.clearInterval(stateRefreshTimer);
                window.removeEventListener("offline", onOffline);
                window.removeEventListener("online", onOnline);
                document.removeEventListener("visibilitychange", onVisibilityChange);
                void client?.removeChannel(channel);
            };
        }

        return () => {
            active = false;
            window.clearInterval(timer);
            window.clearInterval(stateRefreshTimer);
            window.removeEventListener("offline", onOffline);
            window.removeEventListener("online", onOnline);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [code, refresh]);

    const elapsed = sampledAt ? Math.floor((clockNow - sampledAt) / 1000) : 0;
    const projectedMatchSeconds = snapshot
        ? Math.max(0, snapshot.session.remainingSeconds - (snapshot.session.clockState === "running" ? elapsed : 0))
        : 0;
    const projectedMatchOvertimeSeconds = snapshot?.session.clockState === "running"
        ? snapshot.session.remainingSeconds > 0
            ? Math.max(0, elapsed - snapshot.session.remainingSeconds)
            : snapshot.session.matchOvertimeSeconds + elapsed
        : snapshot?.session.matchOvertimeSeconds ?? 0;
    const matchSeconds = optimisticPause?.remainingSeconds ?? projectedMatchSeconds;
    const matchOvertimeSeconds = optimisticPause?.overtimeSeconds ?? projectedMatchOvertimeSeconds;
    const matchStopped = snapshot?.session.status === "live" && (Boolean(optimisticPause) || snapshot.session.clockState === "stopped");
    const stoppageType = optimisticPause?.stoppageType ?? snapshot?.session.stoppageType ?? null;
    const stoppageSeconds = optimisticPause
        ? Math.max(0, Math.floor((clockNow - optimisticPause.pausedAtPerformance) / 1000))
        : matchStopped && snapshot?.session.stoppedAt
            ? Math.max(0, Math.floor((Date.parse(snapshot.serverNow) + (sampledAt ? clockNow - sampledAt : 0) - Date.parse(snapshot.session.stoppedAt)) / 1000))
            : 0;
    const masterSeconds = snapshot?.session.plannedEndsAt
        ? Math.floor((Date.parse(snapshot.session.plannedEndsAt) - (
            snapshot.session.endedAt
                ? Date.parse(snapshot.session.endedAt)
                : Date.parse(snapshot.serverNow) + (sampledAt ? clockNow - sampledAt : 0)
        )) / 1000)
        : null;
    const sessionOvertime = snapshot?.session.status === "live" && masterSeconds !== null && masterSeconds <= 0;
    const isOffline = !browserOnline || !apiReachable;
    // Realtime distributes updates, but controls are server-authorized HTTP actions.
    // A Realtime outage must not disable a timekeeper whose session API is reachable.
    const isConnected = browserOnline && apiReachable && !syncing;
    const connectivityState = isOffline
        ? "offline"
        : realtimeEnabled && !realtimeConnected
            ? "connecting"
            : syncing
                ? "syncing"
                : "online";
    const connectivityLabel = connectivityState === "offline"
        ? "OFFLINE"
        : connectivityState === "connecting"
            ? "CONNECTING"
            : connectivityState === "syncing"
                ? "SYNCING"
                : "ONLINE";
    const connectivityClass = connectivityState === "offline"
        ? styles.connectivityOffline
        : connectivityState === "connecting" || connectivityState === "syncing"
            ? styles.connectivityPending
            : styles.connectivityOnline;

    const hasActiveFixture = Boolean(snapshot?.currentFixture);
    const nextAction = snapshot?.session.status === "waiting" && hasActiveFixture
        ? "start"
        : snapshot?.session.status === "live" && hasActiveFixture && snapshot.session.clockState === "running"
            ? matchSeconds <= 0 ? "finish" : "pause"
            : snapshot?.session.status === "live" && hasActiveFixture && snapshot.session.clockState === "stopped"
                ? "resume"
                : snapshot?.session.status === "live" && hasActiveFixture && snapshot.session.clockState === "ready"
                    ? "start"
                    : null;
    const controlAction = optimisticPause ? "resume" : nextAction;

    const act = async (intent?: "injury" | "normal" | "finish_session") => {
        const action = intent === "finish_session" ? intent : intent ? `pause_${intent}` : nextAction;
        if (!action || busy || !isConnected || (intent === "finish_session" && !capability.canFinishSession) ||
            (intent && intent !== "finish_session" && (!capability.canControl || nextAction !== "pause")) ||
            (!intent && !capability.canControl)) return;
        if (intent && intent !== "finish_session") {
            const pauseType = intent;
            const elapsedAtTap = sampledAt ? Math.floor((performance.now() - sampledAt) / 1000) : 0;
            const remainingAtTap = snapshot
                ? Math.max(0, snapshot.session.remainingSeconds - (snapshot.session.clockState === "running" ? elapsedAtTap : 0))
                : projectedMatchSeconds;
            const overtimeAtTap = snapshot?.session.clockState === "running"
                ? snapshot.session.remainingSeconds > 0
                    ? Math.max(0, elapsedAtTap - snapshot.session.remainingSeconds)
                    : snapshot.session.matchOvertimeSeconds + elapsedAtTap
                : projectedMatchOvertimeSeconds;
            setOptimisticPause({
                remainingSeconds: remainingAtTap,
                overtimeSeconds: overtimeAtTap,
                pausedAtPerformance: performance.now(),
                stoppageType: pauseType,
            });
        }
        setBusy(true);
        setMessage("");
        try {
            let response: Response;
            try {
                response = await fetch(`/api/3kend/sessions/${encodeURIComponent(code)}/actions`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action }),
                });
            } catch (reason) {
                setApiReachable(false);
                throw reason;
            }
            setApiReachable(true);
            const result = await response.json();
            if (!response.ok) throw new Error(result.error ?? "Action failed.");
            await refresh();
        } catch (reason) {
            setMessage(reason instanceof Error ? reason.message : "Action failed.");
            try {
                await refresh();
            } catch {
                // Keep the existing snapshot when the server cannot be reached.
            }
        } finally {
            setOptimisticPause(null);
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <main className={`${styles.screen} ${styles.loadingScreen}`}>
                <div className={`${styles.frame} ${styles.loadingFrame}`}>
                    <Image src="/3kend-mark.svg" alt="3Kend" width={135} height={56} priority className={`${styles.logo} ${styles.loadingLogo}`} />
                    <p className={styles.loadingText} role="status" aria-live="polite">Preparing your session…</p>
                </div>
            </main>
        );
    }

    if (!snapshot) {
        return <main className={styles.screen}><div className={styles.frame}><p role="alert">{error || "SESSION NOT FOUND"}</p></div></main>;
    }

    const { session, currentFixture, fixtures } = snapshot;
    const completed = session.status === "completed";
    const cancelled = session.status === "cancelled";
    const masterOvertimeSeconds = masterSeconds !== null && masterSeconds < 0 ? -masterSeconds : null;
    const masterClockOvertime = masterOvertimeSeconds !== null;
    const isAdminViewer = capability.isAdmin === true || capability.role === "admin";
    const viewerIsActiveTimekeeper = capability.canControl &&
        (capability.role === "team_timekeeper" || capability.role === "session_timekeeper");
    const activeTimekeeperName = viewerIsActiveTimekeeper
        ? capability.actorName ?? snapshot.activeTimekeeper?.name
        : snapshot.activeTimekeeper?.name;
    const timekeeperLabel = isAdminViewer
        ? capability.canControl ? "ADMIN CONTROL" : "ADMIN VIEW"
        : activeTimekeeperName
            ? `TIMEKEEPER · ${activeTimekeeperName}`
            : "NO TIMEKEEPER ASSIGNED";
    const timekeeperContext = isAdminViewer
        ? activeTimekeeperName ? `TIMEKEEPER · ${activeTimekeeperName}` : "NO TIMEKEEPER ASSIGNED"
        : capability.canControl ? "CONTROLS ACTIVE MATCH" : "VIEW ONLY";

    return (
        <main className={styles.screen}>
            <div className={styles.frame}>
                <header className={styles.header}>
                    <Image src="/3kend-mark.svg" alt="3Kend" width={135} height={56} priority className={styles.logo} />
                    <div className={styles.headerMeta}>
                        <span className={styles.previewState}>{session.code}</span>
                    </div>
                </header>

                <section className={styles.sessionSummary} aria-label="Session summary">
                    <div className={`${styles.masterClock} ${masterClockOvertime ? styles.masterClockOvertime : ""}`}>
                        <span>SESSION</span>
                        <strong className={`${styles.masterClockValue} ${masterClockOvertime ? styles.masterClockValueOvertime : ""}`}>
                            {masterOvertimeSeconds !== null
                                ? <><span className={styles.masterOvertimeSign}>+</span><span>{formatClock(masterOvertimeSeconds)}</span></>
                                : masterSeconds === null ? "--:--" : formatClock(masterSeconds)}
                        </strong>
                    </div>
                    <ol className={styles.progress} aria-label={`${session.fixtureCount} match rotation`}>
                        {fixtures.map((fixture, index) => {
                            const current = fixture.number === session.currentFixtureNumber && !completed && !cancelled;
                            const done = fixture.number < session.currentFixtureNumber;
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
                        {currentFixture ? `MATCH ${String(currentFixture.number).padStart(2, "0")}` : completed ? "SESSION COMPLETE" : cancelled ? "SESSION CANCELLED" : "ALL MATCHES PLAYED"}
                        {currentFixture && <span> / {session.fixtureCount}</span>}
                    </p>

                    {currentFixture && <>
                        <div className={styles.teams}>
                            <TeamKitIcon teamKey={currentFixture.home.id} label={currentFixture.home.label}
                                color={currentFixture.home.color} kitType={currentFixture.home.kitType} bibCode={currentFixture.home.bibCode}
                                opacity={currentFixture.home.opacity} />
                            <span className={styles.versus}>VS</span>
                            <TeamKitIcon teamKey={currentFixture.away.id} label={currentFixture.away.label}
                                color={currentFixture.away.color} kitType={currentFixture.away.kitType} bibCode={currentFixture.away.bibCode}
                                opacity={currentFixture.away.opacity} />
                        </div>
                        <div className={styles.clockConnectivity}>
                            <span className={`${styles.connectivityStatus} ${connectivityClass}`}
                                role={isOffline ? "alert" : "status"}
                                aria-live={isOffline ? "assertive" : "polite"}
                                aria-label={isOffline ? "Offline. The clock is an estimate. Check your connection; contact the admin if it does not return." : connectivityLabel}>
                                <span className={styles.connectivityDot} aria-hidden="true" />
                                {connectivityLabel}
                            </span>
                        </div>
                        <SevenSegmentClock
                            value={matchOvertimeSeconds > 0 ? formatClock(matchOvertimeSeconds) : formatClock(matchSeconds)}
                            label={matchOvertimeSeconds > 0
                                ? `Match overtime ${formatClock(matchOvertimeSeconds)}`
                                : `${formatClock(matchSeconds)} playing time remaining`}
                            overtime={matchOvertimeSeconds > 0}
                            stopped={matchStopped}
                        />
                        <div className={styles.clockStatusRegion}>
                            <p className={`${styles.clockStateLabel} ${matchStopped ? styles.clockStateStopped : matchOvertimeSeconds > 0 ? styles.clockStateOvertime : ""}`} aria-live="off">
                                {completed ? "SESSION ENDED" : cancelled ? "SESSION CANCELLED" : matchStopped
                                    ? "STOPPED"
                                    : matchOvertimeSeconds > 0 ? "MATCH OVERTIME" : "PLAYING TIME"}
                            </p>
                            <div className={styles.stoppageClockSlot}>
                                {matchStopped && (
                                    <SevenSegmentClock value={formatClock(stoppageSeconds)}
                                        label={`Stoppage duration ${formatClock(stoppageSeconds)}`} compact stoppage />
                                )}
                            </div>
                            <p className={`${styles.clockStatusMessage} ${message || error || isOffline ? styles.clockStatusAlert : ""}`}
                                role={message || error || isOffline ? (isOffline ? "alert" : "status") : undefined}
                                aria-live={message || error || isOffline ? (isOffline ? "assertive" : "polite") : "off"}
                                title={message || error || (isOffline ? "Offline. The clock is an estimate. Check your connection; contact the admin if it does not return." : undefined)}>
                                {message || error || (isOffline
                                    ? "CLOCK IS AN ESTIMATE · CHECK CONNECTION"
                                    : !capability.canControl && matchStopped && stoppageType === "normal" && stoppageSeconds >= 30
                                        ? "RESUME WHEN PLAY RESTARTS"
                                        : "")}
                            </p>
                        </div>
                        <div className={styles.timekeeperRegion} aria-label="Control and timekeeper status">
                            <p className={styles.timekeeper}>
                                <span className={styles.timekeeperIcon}><UserIcon /></span>
                                <span className={styles.timekeeperLabel}>
                                    {isAdminViewer ? timekeeperLabel : activeTimekeeperName
                                        ? <>{"TIMEKEEPER · "}<strong>{activeTimekeeperName}</strong></>
                                        : timekeeperLabel}
                                </span>
                            </p>
                            <p className={styles.timekeeperContext}>{timekeeperContext}</p>
                        </div>
                    </>}

                    <div className={styles.actionArea}>
                        {nextAction && capability.canControl ? (
                            controlAction === "pause" ? (
                                <div className={`${styles.controlSplit} ${!isConnected ? styles.controlUnavailable : ""}`}>
                                    <button className={`${styles.controlIcon} ${styles.controlIconMedical}`} type="button" onClick={() => void act("injury")}
                                        disabled={busy || !isConnected} aria-label="Pause for injury" title="Injury stoppage">
                                        <MedicalIcon />
                                    </button>
                                    <button className={`${styles.controlIcon} ${styles.controlIconStoppage}`} type="button" onClick={() => void act("normal")}
                                        disabled={busy || !isConnected} aria-label="Pause for normal stoppage" title="Normal stoppage">
                                        <PauseIcon />
                                    </button>
                                </div>
                            ) : controlAction ? (
                                <button className={`${styles.control} ${controlAction === "resume" ? styles.controlResume : ""} ${optimisticPause ? styles.controlPending : ""}`} type="button"
                                    onClick={() => void act()} disabled={busy || !isConnected} aria-busy={busy}
                                    aria-label={ACTION_LABELS[controlAction]}>
                                    {ACTION_LABELS[controlAction]}
                                </button>
                            ) : null
                        ) : hasActiveFixture && !completed && !cancelled ? (
                            <p className={styles.readOnly}>
                                {capability.canControl ? "NO ACTIVE MATCH" : "PUBLIC LIVE VIEW"}
                            </p>
                        ) : null}
                        {capability.canFinishSession && session.status === "live" && (
                            <button className={styles.finishSession} type="button" onClick={() => setFinishDialogOpen(true)} disabled={busy || !isConnected}>
                                Finish session
                            </button>
                        )}
                    </div>
                </section>

                <dialog ref={finishDialogRef} className={styles.finishDialog}
                    aria-labelledby="finish-session-title" aria-describedby="finish-session-description"
                    onClose={() => setFinishDialogOpen(false)}>
                    <div className={styles.finishDialogContent}>
                        <p className={styles.finishDialogEyebrow}>SESSION CONTROL</p>
                        <h2 id="finish-session-title">Finish session?</h2>
                        <p id="finish-session-description">This will end the session and stop its session clock.</p>
                        <div className={styles.finishDialogActions}>
                            <button className={styles.finishDialogCancel} type="button" onClick={() => setFinishDialogOpen(false)} autoFocus>
                                Cancel
                            </button>
                            <button className={styles.finishDialogConfirm} type="button" disabled={busy || !isConnected} onClick={() => {
                                setFinishDialogOpen(false);
                                void act("finish_session");
                            }}>
                                Finish session
                            </button>
                        </div>
                    </div>
                </dialog>

                <footer className={styles.brandFooter} aria-label="Powered by Turfr">
                    <span>POWERED BY</span>
                    <Image src="/turfr-logo-white.svg" alt="Turfr logo" width={70} height={22} className={styles.poweredLogo} />
                </footer>
            </div>
        </main>
    );
}
