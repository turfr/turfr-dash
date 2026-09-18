import {MatchRecord} from "@/lib/types";

type MatchActivityProps = {
    matches: MatchRecord[];
    today: string;
};

function getIntensity(games: number) {
    if (games === 0) return "#eef0f2";
    if (games === 1) return "#86efac";
    return "#22c55e";
}

export function MatchActivity({
                                  matches,
                                  today,
                              }: MatchActivityProps) {
    const todayDate = new Date(`${today}T00:00:00Z`);

    // Monday of the current week.
    const currentWeekStart = new Date(todayDate);
    const dayOfWeek = currentWeekStart.getUTCDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    currentWeekStart.setUTCDate(
        currentWeekStart.getUTCDate() - daysFromMonday,
    );

    // Show the current week + previous 7 weeks.
    const startDate = new Date(currentWeekStart);
    startDate.setUTCDate(startDate.getUTCDate() - 49 - 1);

    const days = 56;

    const activityMap = new Map<string, number>();

    for (const match of matches) {
        const existing = activityMap.get(match.date) ?? 0;

        activityMap.set(
            match.date,
            existing + match.games,
        );
    }

    const calendar = Array.from({ length: days }, (_, index) => {
        const date = new Date(startDate);

        date.setUTCDate(date.getUTCDate() + index);

        const dateString = date.toISOString().slice(0, 10);

        return {
            date: dateString,
            games: activityMap.get(dateString) ?? 0,
        };
    });

    const weeks = Array.from(
        { length: Math.ceil(calendar.length / 7) },
        (_, weekIndex) =>
            calendar.slice(weekIndex * 7, weekIndex * 7 + 7),
    );

    return (
        <section
            style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                padding: "12px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    marginBottom: "12px",
                }}
            >
                <h2
                    style={{
                        margin: 0,
                        fontSize: "16px",
                        fontWeight: 500,
                        color: "#171717",
                    }}
                >
                    Match activity
                </h2>

                <span
                    style={{
                        fontSize: "12px",
                        color: "#737373",
                    }}
                >
                    Last 8 weeks
                </span>
            </div>

            {/* Month labels */}
            <div
                style={{
                    position: "relative",
                    height: "16px",
                    marginLeft: "28px",
                    marginBottom: "2px",
                    width: "calc(100% - 28px)",
                }}
            >
                {weeks.map((week, weekIndex) => {
                    const monthStart = week.find(
                        (day) =>
                            new Date(
                                `${day.date}T00:00:00Z`,
                            ).getUTCDate() === 1,
                    );

                    const isFirstWeek = weekIndex === 0;

                    if (!monthStart && !isFirstWeek) {
                        return null;
                    }

                    const labelDate = monthStart
                        ? new Date(`${monthStart.date}T00:00:00Z`)
                        : new Date(`${week[0].date}T00:00:00Z`);

                    return (
                        <span
                            key={week[0].date}
                            style={{
                                position: "absolute",
                                left: `${weekIndex * 18}px`,
                                fontSize: "11px",
                                lineHeight: "16px",
                                color: "#737373",
                                whiteSpace: "nowrap",
                            }}
                        >
                {labelDate.toLocaleDateString(
                    "en-US",
                    {
                        month: "short",
                        timeZone: "UTC",
                    },
                )}
            </span>
                    );
                })}
            </div>

            {/* Calendar */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: `24px repeat(${weeks.length}, 14px)`,
                    gap: "4px",
                    width: "100%",
                    overflow: "hidden",
                }}
            >
                {/* Weekday labels */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateRows: "repeat(7, 1fr)",
                        gap: "4px",
                    }}
                >
                    {["", "M", "", "W", "", "F", ""].map(
                        (day, index) => (
                            <span
                                key={index}
                                style={{
                                    fontSize: "10px",
                                    lineHeight: "12px",
                                    color: "#737373",
                                    textAlign: "right",
                                }}
                            >
                                {day}
                            </span>
                        ),
                    )}
                </div>

                {/* Activity squares */}
                {weeks.map((week) => (
                    <div
                        key={week[0].date}
                        style={{
                            display: "grid",
                            gridTemplateRows:
                                "repeat(7, 14px)",
                            gap: "4px",
                            minWidth: 0,
                        }}
                    >
                        {week.map((day) => (
                            <div
                                key={day.date}
                                title={`${day.date}: ${day.games} game${day.games === 1 ? "" : "s"}`}
                                style={{
                                    width: "14px",
                                    height: "14px",
                                    borderRadius: "3px",
                                    backgroundColor:
                                        getIntensity(day.games),
                                }}
                            />
                        ))}
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "5px",
                    marginTop: "8px",
                    fontSize: "11px",
                    color: "#737373",
                }}
            >
                <span>Less</span>

                {[0, 1, 2].map((games) => (
                    <span
                        key={games}
                        style={{
                            width: "10px",
                            height: "10px",
                            borderRadius: "3px",
                            backgroundColor:
                                getIntensity(games),
                        }}
                    />
                ))}

                <span>More</span>
            </div>
        </section>
    );
}