import styles from "./page.module.css";

const SEGMENTS = {
    a: { x: 12, y: 4, width: 24, height: 6 },
    b: { x: 37, y: 11, width: 6, height: 24 },
    c: { x: 37, y: 43, width: 6, height: 24 },
    d: { x: 12, y: 68, width: 24, height: 6 },
    e: { x: 5, y: 43, width: 6, height: 24 },
    f: { x: 5, y: 11, width: 6, height: 24 },
    g: { x: 12, y: 36, width: 24, height: 6 },
} as const;

const DIGIT_SEGMENTS: Record<string, readonly (keyof typeof SEGMENTS)[]> = {
    "0": ["a", "b", "c", "d", "e", "f"],
    "1": ["b", "c"],
    "2": ["a", "b", "g", "e", "d"],
    "3": ["a", "b", "g", "c", "d"],
    "4": ["f", "g", "b", "c"],
    "5": ["a", "f", "g", "c", "d"],
    "6": ["a", "f", "g", "e", "c", "d"],
    "7": ["a", "b", "c"],
    "8": ["a", "b", "c", "d", "e", "f", "g"],
    "9": ["a", "b", "c", "d", "f", "g"],
};

function Digit({ value }: { value: string }) {
    const litSegments = DIGIT_SEGMENTS[value] ?? [];

    return (
            <svg className={styles.digit} viewBox="0 0 48 78" aria-hidden="true">
            {(Object.entries(SEGMENTS) as [keyof typeof SEGMENTS, (typeof SEGMENTS)[keyof typeof SEGMENTS]][]).map(
                ([name, segment]) => (
                    <rect
                        key={name}
                        {...segment}
                        rx="1.5"
                        className={litSegments.includes(name) ? styles.segmentLit : styles.segmentUnlit}
                    />
                ),
            )}
        </svg>
    );
}

export function SevenSegmentClock({
    value,
    label,
}: {
    value: string;
    label: string;
}) {
    return (
        <div className={styles.clock} role="img" aria-label={label}>
            {value.split("").map((character, index) =>
                character === ":" ? (
                    <span key={`colon-${index}`} className={styles.clockColon} aria-hidden="true">
                        <i />
                        <i />
                    </span>
                ) : (
                    <Digit key={`digit-${index}`} value={character} />
                ),
            )}
        </div>
    );
}
