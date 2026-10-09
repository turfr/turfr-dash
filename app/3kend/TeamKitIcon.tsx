import styles from "./page.module.css";

type TeamKitIconProps = {
    teamKey: string;
    label: string;
    color: string;
    kitType: "jersey" | "bibs";
    bibCode?: string;
};

export function TeamKitIcon({ teamKey, label, color, kitType, bibCode }: TeamKitIconProps) {
    const kitName = kitType === "bibs" ? "bibs" : "jersey";
    const description = [`Team ${teamKey}`, label, bibCode, kitName].filter(Boolean).join(", ");
    const letterColor = getLetterColor(color);

    return (
        <svg
            className={styles.teamKitIcon}
            viewBox="0 0 48 48"
            role="img"
            aria-label={description}
            xmlns="http://www.w3.org/2000/svg"
        >
            {kitType === "bibs" ? (
                <>
                    <path d="M14 5h7l3 5 3-5h7l8 8-5 6-5-3v25H16V16l-5 3-5-6 8-8Z" fill={color} />
                    <path d="M21 5c0 4 6 4 6 0" fill="none" stroke="#090a09" strokeOpacity=".38" strokeWidth="1.6" />
                </>
            ) : (
                <>
                    <path d="M14 5h6c.7 4 7.3 4 8 0h6l8 7-4 8-6-3v22H16V17l-6 3-4-8 8-7Z" fill={color} />
                    <path d="M20 5c.7 4 7.3 4 8 0" fill="none" stroke="#090a09" strokeOpacity=".38" strokeWidth="1.6" />
                </>
            )}
            <text
                x="24"
                y="29"
                textAnchor="middle"
                dominantBaseline="middle"
                fill={letterColor}
                fontFamily="Arial, sans-serif"
                fontSize="16"
                fontWeight="700"
            >
                {teamKey}
            </text>
        </svg>
    );
}

function getLetterColor(color: string): string {
    const channels = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
    if (!channels) return "#090a09";

    const linear = (channel: string) => {
        const value = Number.parseInt(channel, 16) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const luminance = 0.2126 * linear(channels[1]) + 0.7152 * linear(channels[2]) + 0.0722 * linear(channels[3]);
    return luminance > 0.179 ? "#090a09" : "#f2f3eb";
}

