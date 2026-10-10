export const KIT_COLOR_PRESETS = [
    { name: "Black", value: "#111210" },
    { name: "Dark gray", value: "#777b80" },
    { name: "White", value: "#f2f3eb" },
    { name: "Red", value: "#ef4136" },
    { name: "Blue", value: "#2463eb" },
    { name: "Neon orange", value: "#ff8538" },
    { name: "Neon yellow", value: "#e4f542" },
] as const;

export function getKitLabelColor(color: string): "#f2f3eb" | "#090a09" {
    const channels = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
    if (!channels) return "#090a09";

    const rgb = channels.slice(1).map((channel) => Number.parseInt(channel, 16) / 255);
    const [red, green, blue] = rgb;
    const linear = (value: number) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    const luminance = 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const saturation = maximum === 0 ? 0 : (maximum - minimum) / maximum;

    // Dark custom colours and dark neutrals get a white label. Saturated,
    // brighter football colours keep the predictable black label.
    return luminance <= 0.15 || (saturation <= 0.18 && luminance <= 0.43)
        ? "#f2f3eb"
        : "#090a09";
}
