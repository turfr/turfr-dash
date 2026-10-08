import styles from "./page.module.css";

export function SevenSegmentClock({
    value,
    label,
}: {
    value: string;
    label: string;
}) {
    return (
        <div className={styles.clock} role="img" aria-label={label}>
            <span className={styles.clockSegmentsOff} aria-hidden="true">
                88:88
            </span>
            <span className={styles.clockValue} aria-hidden="true">
                {value}
            </span>
        </div>
    );
}
