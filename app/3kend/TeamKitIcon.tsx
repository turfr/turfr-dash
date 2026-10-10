import type { CSSProperties } from "react";
import styles from "./page.module.css";
import { getKitLabelColor } from "@/lib/3kend/kit-colors";

type TeamKitIconProps = {
    teamKey: string;
    label: string;
    color: string;
    kitType: "jersey" | "bibs";
    bibCode?: string;
    opacity?: number;
    size?: number;
    className?: string;
};

export function TeamKitIcon({ teamKey, label, color, kitType, bibCode, opacity = 1, size, className }: TeamKitIconProps) {
    const kitName = kitType === "bibs" ? "bibs" : "jersey";
    const description = [`Team ${teamKey}`, label, bibCode, kitName].filter(Boolean).join(", ");
    const asset = kitType === "bibs" ? "/3kend/bibs.svg" : "/3kend/jersey.svg";
    const aspectRatio = kitType === "bibs" ? "357 / 443" : "429 / 445";
    const widthRatio = kitType === "bibs" ? 357 / 443 : 429 / 445;
    const shapeClass = kitType === "bibs" ? styles.teamKitBibs : styles.teamKitJersey;

    return (
        <span
            className={[styles.teamKitIcon, shapeClass, className].filter(Boolean).join(" ")}
            role="img"
            aria-label={description}
            style={{
                "--kit-color": color,
                "--kit-label-color": getKitLabelColor(color),
                "--kit-asset": `url("${asset}")`,
                "--kit-aspect-ratio": aspectRatio,
                "--kit-opacity": Math.max(0, Math.min(1, opacity)),
                "--kit-label-size": `${Math.max(8, Math.min(16, 52 / Math.max(1, label.length)))}px`,
                ...(size ? { width: `${size * widthRatio}px`, height: `${size}px` } : {}),
            } as CSSProperties}
        >
            <span className={styles.teamKitShape} aria-hidden="true" />
            <span className={styles.teamKitLetter} aria-hidden="true">{label || teamKey}</span>
        </span>
    );
}
