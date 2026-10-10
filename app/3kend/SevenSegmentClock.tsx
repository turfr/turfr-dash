import styles from "./page.module.css";

export function SevenSegmentClock({
    value,
    label,
    overtime = false,
    stopped = false,
    compact = false,
    stoppage = false,
}: {
    value: string;
    label: string;
    overtime?: boolean;
    stopped?: boolean;
    compact?: boolean;
    stoppage?: boolean;
}) {
    return (
        <div className={`${styles.clock} ${overtime ? styles.clockOvertime : ""} ${stopped ? styles.clockStopped : ""} ${compact ? styles.clockCompact : ""} ${stoppage ? styles.clockStoppage : ""}`} role="img" aria-label={label}>
            <span className={styles.overtimeIndicator} aria-hidden="true">
                +
            </span>
            <span className={styles.clockDigits} aria-hidden="true">
                <span className={styles.clockSegmentsOff}>88:88</span>
                <span className={styles.clockValue}>{value}</span>
            </span>
        </div>
    );
}
