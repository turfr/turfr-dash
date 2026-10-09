"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import styles from "./setup.module.css";

type TeamSetup = {
    key: "A" | "B" | "C";
    label: string;
    bibCode: string;
    colorHex: string;
    kitType: "jersey" | "bibs";
};

type SessionCreated = {
    publicCode: string;
    publicPath: string;
    fixtureCount: number;
    matchMinutes: number;
    sessionWindowMinutes: number;
    plannedPlayMinutes: number;
    plannedBufferMinutes: number;
};

type InviteStatus = {
    id: string;
    invitee_name: string;
    role: string;
    team_key: string | null;
    status: string;
    accepted_at: string | null;
    expires_at: string;
};

type InviteLink = {
    inviteId: string;
    teamKey: string;
    inviteeName: string;
    inviteUrl: string;
};

const initialTeams: TeamSetup[] = [
    { key: "A", label: "A", bibCode: "Black", colorHex: "#777b80", kitType: "bibs" },
    { key: "B", label: "B", bibCode: "White", colorHex: "#f2f3eb", kitType: "bibs" },
    { key: "C", label: "C", bibCode: "Orange", colorHex: "#ff8538", kitType: "bibs" },
];

export function AdminSetup() {
    const [checking, setChecking] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [recoveryKey, setRecoveryKey] = useState("");
    const [teams, setTeams] = useState(initialTeams);
    const [fixtureCount, setFixtureCount] = useState(12);
    const [matchMinutes, setMatchMinutes] = useState(8);
    const [sessionWindowMinutes, setSessionWindowMinutes] = useState(120);
    const [session, setSession] = useState<SessionCreated | null>(null);
    const [inviteNames, setInviteNames] = useState<Record<string, string>>({ A: "", B: "", C: "" });
    const [invitePhones, setInvitePhones] = useState<Record<string, string>>({ A: "", B: "", C: "" });
    const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
    const [inviteStatuses, setInviteStatuses] = useState<InviteStatus[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    useEffect(() => {
        let active = true;
        fetch("/api/3kend/admin/claim", { cache: "no-store" })
            .then(async (response) => {
                if (!response.ok) return;
                const result = await response.json();
                if (active) setIsAdmin(Boolean(result.isAdmin));
            })
            .catch(() => undefined)
            .finally(() => { if (active) setChecking(false); });
        return () => { active = false; };
    }, []);

    const claimAdmin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
            const response = await fetch("/api/3kend/admin/claim", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: recoveryKey }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error ?? "Could not claim admin access.");
            setRecoveryKey("");
            setIsAdmin(true);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Could not claim admin access.");
        } finally {
            setBusy(false);
        }
    };

    const updateTeam = (key: TeamSetup["key"], patch: Partial<TeamSetup>) => {
        setTeams((current) => current.map((team) => team.key === key ? { ...team, ...patch } : team));
    };

    const createSession = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        setNotice("");
        try {
            const response = await fetch("/api/3kend/sessions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fixtureCount,
                    matchMinutes,
                    sessionWindowMinutes,
                    teams: teams.map((team) => ({
                        ...team,
                        kitType: team.kitType === "jersey" ? "jersey" : "bibs",
                    })),
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error ?? "Could not create the session.");
            setSession(result as SessionCreated);
            setInviteLinks([]);
            setInviteStatuses([]);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Could not create the session.");
        } finally {
            setBusy(false);
        }
    };

    const refreshInviteStatuses = async (code: string) => {
        const response = await fetch(`/api/3kend/sessions/${encodeURIComponent(code)}/invites`, { cache: "no-store" });
        const result = await response.json();
        if (response.ok) setInviteStatuses(result.invites ?? []);
    };

    const createInvite = async (team: TeamSetup) => {
        const inviteeName = inviteNames[team.key]?.trim();
        if (!session || !inviteeName) {
            setError(`Enter the timekeeper's name for Team ${team.key}.`);
            return;
        }
        setBusy(true);
        setError("");
        setNotice("");
        try {
            const response = await fetch(`/api/3kend/sessions/${session.publicCode}/invites`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    inviteeName,
                    whatsappPhone: invitePhones[team.key]?.trim() || null,
                    role: "team_timekeeper",
                    teamKey: team.key,
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error ?? "Could not create this invite.");
            setInviteLinks((current) => [
                ...current.filter((invite) => invite.teamKey !== team.key),
                { inviteId: result.inviteId, teamKey: team.key, inviteeName, inviteUrl: result.inviteUrl },
            ]);
            await refreshInviteStatuses(session.publicCode);
            setNotice(`Invite ready for ${inviteeName}. Share the link with them privately.`);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Could not create this invite.");
        } finally {
            setBusy(false);
        }
    };

    const revokeInvite = async (inviteId: string) => {
        if (!session) return;
        setBusy(true);
        setError("");
        try {
            const response = await fetch(`/api/3kend/sessions/${session.publicCode}/invites/${inviteId}`, { method: "DELETE" });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error ?? "Could not revoke invite.");
            await refreshInviteStatuses(session.publicCode);
            setInviteLinks((current) => current.filter((invite) => invite.inviteId !== inviteId));
            setNotice("Invite revoked. Create a replacement invite for the new timekeeper.");
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Could not revoke invite.");
        } finally {
            setBusy(false);
        }
    };

    const copyText = async (value: string, label: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setNotice(`${label} copied.`);
        } catch {
            setError("Clipboard access failed. Select and copy the link manually.");
        }
    };

    if (checking) return <main className={styles.screen}><p>CHECKING ADMIN ACCESS…</p></main>;

    return (
        <main className={styles.screen}>
            <div className={styles.frame}>
                <header className={styles.header}>
                    <Image src="/3kend-mark.svg" alt="3Kend" width={135} height={56} priority className={styles.logo} />
                    <Link href="/3kend" className={styles.backLink}>PUBLIC VIEW</Link>
                </header>

                {!isAdmin ? (
                    <section className={styles.section}>
                        <p className={styles.eyebrow}>ADMIN ACCESS</p>
                        <h1>Claim session control</h1>
                        <p className={styles.hint}>Enter your recovery key. This device receives a private admin session.</p>
                        <form onSubmit={claimAdmin} className={styles.form}>
                            <label className={styles.label} htmlFor="recovery-key">Recovery key</label>
                            <input id="recovery-key" className={styles.input} type="password" autoComplete="current-password"
                                value={recoveryKey} onChange={(event) => setRecoveryKey(event.target.value)} required />
                            <button className={styles.button} type="submit" disabled={busy || recoveryKey.length < 32}>
                                {busy ? "CHECKING…" : "CLAIM ADMIN ACCESS"}
                            </button>
                        </form>
                    </section>
                ) : session ? (
                    <section className={styles.section}>
                        <p className={styles.eyebrow}>SESSION {session.publicCode}</p>
                        <h1>Invite timekeepers</h1>
                        <p className={styles.hint}>The WhatsApp number is for your reference; v1 verifies access through the private invite link.</p>
                        <div className={styles.shareBlock}>
                            <span>PUBLIC SESSION LINK</span>
                            <code>{typeof window === "undefined" ? session.publicPath : `${window.location.origin}${session.publicPath}`}</code>
                            <button className={styles.smallButton} type="button"
                                onClick={() => void copyText(`${window.location.origin}${session.publicPath}`, "Session link")}>
                                COPY SESSION LINK
                            </button>
                        </div>
                        <p className={styles.planLine}>
                            {session.fixtureCount} matches · {session.matchMinutes} min each · {session.plannedBufferMinutes} min buffer
                        </p>

                        <div className={styles.invites}>
                            {teams.map((team) => {
                                const invite = inviteLinks.find((item) => item.teamKey === team.key);
                                const status = inviteStatuses.find((item) => item.team_key === team.key && item.status !== "revoked");
                                return (
                                    <article className={styles.inviteRow} key={team.key}>
                                        <h2 style={{ "--team-color": team.colorHex } as React.CSSProperties}>
                                            TEAM {team.label} <span>{team.kitType.toUpperCase()} · {team.bibCode}</span>
                                        </h2>
                                        <label className={styles.label} htmlFor={`invite-name-${team.key}`}>Timekeeper name</label>
                                        <input id={`invite-name-${team.key}`} className={styles.input}
                                            value={inviteNames[team.key]} onChange={(event) => setInviteNames((current) => ({ ...current, [team.key]: event.target.value }))} />
                                        <label className={styles.label} htmlFor={`invite-phone-${team.key}`}>WhatsApp number (optional)</label>
                                        <input id={`invite-phone-${team.key}`} className={styles.input} type="tel" inputMode="tel"
                                            value={invitePhones[team.key]} onChange={(event) => setInvitePhones((current) => ({ ...current, [team.key]: event.target.value }))} />
                                        {status && <p className={styles.statusLine}>INVITE {status.status.toUpperCase()}{status.accepted_at ? " · ACCEPTED" : ""}</p>}
                                        {invite ? (
                                            <div className={styles.shareBlock}>
                                                <span>PRIVATE LINK · SEND TO {invite.inviteeName.toUpperCase()}</span>
                                                <code>{invite.inviteUrl}</code>
                                                <button className={styles.smallButton} type="button" onClick={() => void copyText(invite.inviteUrl, "Invite link")}>COPY INVITE</button>
                                                <button className={styles.textButton} type="button" disabled={busy} onClick={() => void revokeInvite(invite.inviteId)}>REVOKE LINK</button>
                                            </div>
                                        ) : (
                                            <button className={styles.smallButton} type="button" disabled={busy || !inviteNames[team.key].trim()}
                                                onClick={() => void createInvite(team)}>
                                                CREATE / REPLACE INVITE
                                            </button>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                        <button className={styles.textButton} type="button" onClick={() => void refreshInviteStatuses(session.publicCode)}>REFRESH INVITE STATUS</button>
                    </section>
                ) : (
                    <section className={styles.section}>
                        <p className={styles.eyebrow}>CLASSIC ROTATION</p>
                        <h1>Set up a session</h1>
                        <p className={styles.hint}>Three teams rotate A vs B → B vs C → C vs A. Fixture counts must be a multiple of three.</p>
                        <form onSubmit={createSession} className={styles.form}>
                            <div className={styles.settingsGrid}>
                                <label className={styles.field}>
                                    <span>Fixtures</span>
                                    <input className={styles.input} type="number" min={3} max={60} step={3} value={fixtureCount}
                                        onChange={(event) => setFixtureCount(Number(event.target.value))} required />
                                </label>
                                <label className={styles.field}>
                                    <span>Match minutes</span>
                                    <input className={styles.input} type="number" min={1} max={60} value={matchMinutes}
                                        onChange={(event) => setMatchMinutes(Number(event.target.value))} required />
                                </label>
                                <label className={styles.field}>
                                    <span>Session window</span>
                                    <input className={styles.input} type="number" min={fixtureCount * matchMinutes} max={360} value={sessionWindowMinutes}
                                        onChange={(event) => setSessionWindowMinutes(Number(event.target.value))} required />
                                </label>
                            </div>
                            <p className={styles.planLine}>
                                {fixtureCount * matchMinutes} min playing · {Math.max(0, sessionWindowMinutes - fixtureCount * matchMinutes)} min planned buffer
                            </p>
                            <div className={styles.teamList}>
                                {teams.map((team) => (
                                    <div className={styles.teamRow} key={team.key}>
                                        <strong style={{ "--team-color": team.colorHex } as React.CSSProperties}>{team.label}</strong>
                                        <label className={styles.field}>
                                            <span>Team label</span>
                                            <input className={styles.input} value={team.label} maxLength={40} required
                                                onChange={(event) => updateTeam(team.key, { label: event.target.value })} />
                                        </label>
                                        <label className={styles.field}>
                                            <span>Kit color or code</span>
                                            <input className={styles.input} value={team.bibCode} maxLength={40} required
                                                onChange={(event) => updateTeam(team.key, { bibCode: event.target.value })} />
                                        </label>
                                        <label className={`${styles.field} ${styles.kitField}`}>
                                            <span>Kit style</span>
                                            <select className={styles.input} value={team.kitType ?? "bibs"}
                                                onChange={(event) => updateTeam(team.key, { kitType: event.target.value as TeamSetup["kitType"] })}>
                                                <option value="jersey">Jersey</option>
                                                <option value="bibs">Bibs</option>
                                            </select>
                                        </label>
                                        <label className={styles.colorField}>
                                            <span>Display color</span>
                                            <input type="color" value={team.colorHex} aria-label={`Team ${team.key} display color`}
                                                onChange={(event) => updateTeam(team.key, { colorHex: event.target.value })} />
                                        </label>
                                    </div>
                                ))}
                            </div>
                            <button className={styles.button} type="submit" disabled={busy}>
                                {busy ? "CREATING…" : "CREATE SESSION"}
                            </button>
                        </form>
                    </section>
                )}

                {(error || notice) && <p className={error ? styles.error : styles.notice} role={error ? "alert" : "status"}>{error || notice}</p>}
                <footer className={styles.brandFooter} aria-label="Powered by Turfr">
                    <span>POWERED BY</span>
                    <Image src="/turfr-logo-white.svg" alt="Turfr logo" width={70} height={22} className={styles.poweredLogo} />
                </footer>
            </div>
        </main>
    );
}
