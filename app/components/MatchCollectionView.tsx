import {calculateWeekCollection} from "@/lib/dashboard/calculations";
import {MatchWeek} from "@/lib/dashboard/grouping";

type MatchCollectionViewProps = {
    week: MatchWeek;
    today: string;
};

function formatDay(date: string) {
    const value = new Date(`${date}T00:00:00Z`);

    return {
        day: value.getUTCDate(),
        weekday: value.toLocaleDateString("en-IN", {
            weekday: "short",
            timeZone: "UTC",
        }),
    };
}

export function MatchCollectionView({
                                        week,
                                        today,
                                    }: MatchCollectionViewProps) {
    const collection = calculateWeekCollection(week.matches);

    const days = Array.from({length: 7}, (_, index) => {
        const date = new Date(`${week.startDate}T00:00:00Z`);

        date.setUTCDate(date.getUTCDate() + index);

        return date;
    });

    const dailyRecords = days.map((day) => {
        const date = day.toISOString().slice(0, 10);

        return {
            date,
            matches: week.matches.filter(
                (match) => match.date === date,
            ),
        };
    });

    const collectionPercentage =
        collection.expected > 0
            ? Math.min(
                (collection.received / collection.expected) * 100,
                100,
            )
            : 0;

    function getOrdinalSuffix(day: number) {
        if (day >= 11 && day <= 13) {
            return "th";
        }

        switch (day % 10) {
            case 1:
                return "st";
            case 2:
                return "nd";
            case 3:
                return "rd";
            default:
                return "th";
        }
    }

    return (
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            {/* Weekly summary */}
            <header className="border-b border-neutral-100 px-5 pb-4 pt-4">
                <div className="mt-2 flex items-baseline justify-between gap-4">
                    <h1 className="text-xl font-semibold tracking-tight">
                        {formatDay(week.startDate).day}{" "}
                        {formatDay(week.startDate).weekday}
                        {" → "}
                        {formatDay(week.endDate).day}{" "}
                        {formatDay(week.endDate).weekday}
                    </h1>
                </div>

                <div className="mt-4 flex items-end justify-between">
                    <div>
                        <p className="text-2xl font-semibold tracking-tight">
                            {week.matches.length}
                        </p>
                        <p className="text-xs text-neutral-500">
                            matches
                        </p>
                    </div>

                    <div className="text-right">
                        <p className="text-2xl font-semibold tracking-tight">
                            ₹{collection.received.toLocaleString("en-IN")}
                        </p>
                        <p className="text-xs text-neutral-500">
                            Total
                        </p>
                    </div>
                </div>

                {/* Collection bar */}
                <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="text-neutral-500">
                            Expected ₹
                            {collection.expected.toLocaleString("en-IN")}
                        </span>

                        <span className="font-medium">
                            {collection.difference >= 0 ? "+" : ""}
                            ₹
                            {collection.difference.toLocaleString(
                                "en-IN",
                            )}
                        </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                        <div
                            className="h-full rounded-full bg-neutral-900"
                            style={{
                                width: `${collectionPercentage}%`,
                            }}
                        />
                    </div>
                </div>
            </header>

            {/* Daily records */}
            <div className="divide-y divide-neutral-100">
                {dailyRecords.map((day) => {
                    const formatted = formatDay(day.date);

                    const isToday = day.date === today;
                    const isFuture = day.date > today;

                    const amount = day.matches.reduce(
                        (sum, match) => sum + match.received,
                        0,
                    );

                    const hasGames = day.matches.length > 0;
                    const hasMultipleGames = day.matches.length > 1;

                    const note = day.matches
                        .map((match) => match.note)
                        .filter(Boolean)
                        .join(" · ");

                    return (
                        <div
                            key={day.date}
                            className={`h-16 px-5 ${
                                isFuture ? "text-neutral-300" : ""
                            }`}
                        >
                            <div className="flex h-full items-center gap-3">

                                {/* Date */}
                                <span className="self-start pt-2 text-xs text-neutral-500">
                {formatted.day}
                                    <sup className="ml-0.5 text-[9px]">
                    {getOrdinalSuffix(formatted.day)}
                </sup>
            </span>

                                {/* Day + secondary information */}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-3">
                    <span
                        className={`text-xl font-semibold leading-none ${
                            isFuture ? "text-neutral-300" : ""
                        }`}
                    >
                        {formatted.weekday}
                    </span>

                                        {hasMultipleGames && (
                                            <span className="truncate text-xs text-neutral-500">
                            {day.matches.length} games
                        </span>
                                        )}

                                        {!hasGames && !isFuture && !isToday && (
                                            <span className="truncate text-sm italic text-neutral-500">
                            No recorded games
                        </span>
                                        )}
                                    </div>

                                    {note && (
                                        <p className="mt-1 truncate text-xs text-amber-600">
                                            {note}
                                        </p>
                                    )}
                                </div>

                                {/* Amount / Today / Future */}
                                {hasGames ? (
                                    <span className="shrink-0 text-lg font-medium">
                    ₹{amount.toLocaleString("en-IN")}
                </span>
                                ) : isToday ? (
                                    <span className="shrink-0 text-lg font-medium text-blue-600">
                    Today
                </span>
                                ) : isFuture ? (
                                    <span className="shrink-0 text-lg text-neutral-300">
                    —
                </span>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}