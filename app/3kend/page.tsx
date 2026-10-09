import type { Metadata } from "next";
import Image from "next/image";
import { generateClassicRotation, type RotationTeam } from "@/lib/3kend/classic-rotation";
import { SevenSegmentClock } from "./SevenSegmentClock";
import { TeamKitIcon } from "./TeamKitIcon";
import styles from "./page.module.css";

export const metadata: Metadata = {
    title: "3Kend Classic Rotation | Turfr",
    description: "Live 3Kend football session view.",
};

// Preview colors only; replace these with the teams' assigned colors when configured.
type PreviewTeam = RotationTeam & { kitType: "jersey" | "bibs"; bibCode: string };

const teams = [
    { id: "A", label: "A", color: "#777b80", kitType: "bibs", bibCode: "Black" },
    { id: "B", label: "B", color: "#f2f3eb", kitType: "jersey", bibCode: "White" },
    { id: "C", label: "C", color: "#ff8538", kitType: "bibs", bibCode: "Orange" },
] as const satisfies readonly [PreviewTeam, PreviewTeam, PreviewTeam];

const fixtures = generateClassicRotation(teams);
const previewFixture = fixtures[0];

export default function ThreeKendPage() {
    return (
        <main className={styles.screen}>
            <div className={styles.frame}>
                <header className={styles.header}>
                    <Image
                        src="/3kend-mark.svg"
                        alt="3Kend"
                        width={135}
                        height={56}
                        priority
                        className={styles.logo}
                    />
                    <span className={styles.previewState}>LOCAL PREVIEW</span>
                </header>

                <section className={styles.sessionSummary} aria-label="Session summary">
                    <div className={styles.masterClock}>
                        <span>SESSION</span>
                        <strong>--:--</strong>
                        <span className={styles.notStarted}>NOT STARTED</span>
                    </div>

                    <ol className={styles.progress} aria-label="Twelve match rotation">
                        {fixtures.map((fixture, index) => (
                            <li
                                key={fixture.matchNumber}
                                className={index === 0 ? styles.currentMatch : styles.upcomingMatch}
                                aria-current={index === 0 ? "step" : undefined}
                                aria-label={`Match ${fixture.matchNumber}: ${fixture.home.label} versus ${fixture.away.label}; team ${fixture.resting.label} rests`}
                            >
                                {String(fixture.matchNumber).padStart(2, "0")}
                            </li>
                        ))}
                    </ol>
                </section>

                <section className={styles.match} aria-label="3Kend match control preview">
                    <p className={styles.matchCount}>MATCH 01 <span>/ 12</span></p>

                    <div className={styles.teams}>
                        <TeamKitIcon teamKey={previewFixture.home.id} label={previewFixture.home.label}
                            color={previewFixture.home.color} kitType={previewFixture.home.kitType} bibCode={previewFixture.home.bibCode} />
                        <span className={styles.versus}>VS</span>
                        <TeamKitIcon teamKey={previewFixture.away.id} label={previewFixture.away.label}
                            color={previewFixture.away.color} kitType={previewFixture.away.kitType} bibCode={previewFixture.away.bibCode} />
                    </div>

                    <SevenSegmentClock value="09:00" label="Nine minutes remaining" />
                    <p className={styles.clockCaption}>PLAYING TIME</p>

                    <p className={styles.timekeeper}>
                        <span className={styles.timekeeperDot} />
                        TIMEKEEPER <strong>Shashwat</strong>
                    </p>

                    <div className={styles.actionArea}>
                        <button className={styles.control} type="button" disabled>
                            START MATCH
                        </button>
                    </div>
                </section>

                <footer className={styles.brandFooter} aria-label="Powered by Turfr">
                    <span>POWERED BY</span>
                    <Image
                        src="/turfr-logo-white.svg"
                        alt="Turfr logo"
                        width={70}
                        height={22}
                        className={styles.poweredLogo}
                    />
                </footer>
            </div>
        </main>
    );
}
