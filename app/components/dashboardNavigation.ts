export type DashboardView =
    | "summary"
    | "matches"
    | "sponsors"
    | "purchases"
    | "donations";

export function getDashboardView(value: string | null): DashboardView {
    if (
        value === "matches" ||
        value === "sponsors" ||
        value === "purchases" ||
        value === "donations"
    ) {
        return value;
    }

    return "summary";
}