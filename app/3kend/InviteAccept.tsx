"use client";

import Image from "next/image";
import { useState } from "react";
import styles from "./admin/setup.module.css";

export function InviteAccept({ token }: { token: string }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const acceptInvite = async () => {
        setBusy(true);
        setError("");
        try {
            const response = await fetch("/api/3kend/invites/accept", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error ?? "This invitation could not be accepted.");
            window.location.replace(`/3kend/${encodeURIComponent(result.sessionCode)}`);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "This invitation could not be accepted.");
            setBusy(false);
        }
    };

    return (
        <main className={styles.screen}>
            <meta name="referrer" content="no-referrer" />
            <div className={styles.frame}>
                <header className={styles.header}>
                    <Image src="/3kend-mark.svg" alt="3Kend" width={135} height={56} priority className={styles.logo} />
                </header>
                <section className={styles.section}>
                    <p className={styles.eyebrow}>TIMEKEEPER INVITE</p>
                    <h1>Accept this session role</h1>
                    <p className={styles.hint}>Accepting gives this browser control only when your assignment is active. Keep this link private.</p>
                    <div className={styles.form}>
                        <button className={styles.button} type="button" onClick={() => void acceptInvite()} disabled={busy}>
                            {busy ? "ACCEPTING…" : "ACCEPT INVITE"}
                        </button>
                    </div>
                    {error && <p className={styles.error} role="alert">{error}</p>}
                </section>
                <footer className={styles.brandFooter} aria-label="Powered by Turfr">
                    <span>POWERED BY</span>
                    <Image src="/turfr-logo-white.svg" alt="Turfr logo" width={70} height={22} className={styles.poweredLogo} />
                </footer>
            </div>
        </main>
    );
}
