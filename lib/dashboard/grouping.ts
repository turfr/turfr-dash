import {MatchRecord} from "@/lib/types";

export type MatchWeek = {
    startDate: string;
    endDate: string;
    matches: MatchRecord[];
};

function getWeekStart(date: string): Date {
    const value = new Date(`${date}T00:00:00Z`);
    const day = value.getUTCDay();

    const diff = day === 0 ? 0 : -day;

    value.setUTCDate(value.getUTCDate() + diff);

    return value;
}

function formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

export function groupMatchesByWeek(
    matches: MatchRecord[],
): MatchWeek[] {
    const weeks = new Map<string, MatchWeek>();

    for (const match of matches) {
        const start = getWeekStart(match.date);
        const end = new Date(start);

        end.setUTCDate(end.getUTCDate() + 6);

        const startDate = formatDate(start);
        const endDate = formatDate(end);

        const existing = weeks.get(startDate);

        if (existing) {
            existing.matches.push(match);
        } else {
            weeks.set(startDate, {
                startDate,
                endDate,
                matches: [match],
            });
        }
    }

    return Array.from(weeks.values()).sort((a, b) =>
        b.startDate.localeCompare(a.startDate),
    );
}

export function getCurrentWeek(): MatchWeek {
    const today = new Date();

    const start = getWeekStart(today.toISOString().slice(0, 10));
    const end = new Date(start);

    end.setUTCDate(end.getUTCDate() + 6);

    return {
        startDate: formatDate(start),
        endDate: formatDate(end),
        matches: [],
    };
}