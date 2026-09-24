"use client";

import {useEffect, useState} from "react";
import {FundSummary} from "./FundSummary";
import {useDashboardNavigation} from "@/app/components/useDashboardNavigation";
import {MatchRecord} from "@/lib/types";
import {MatchCollectionView} from "@/app/components/MatchCollectionView";
import {MatchWeek} from "@/lib/dashboard/grouping";
import {FundFlow} from "@/app/components/FundFlow";
import {MatchActivity} from "@/app/components/MatchActivity";

function formatDateRange(startDate: string, endDate: string) {
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);

    const format = (date: Date) =>
        date.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            timeZone: "UTC",
        });

    return {
        start: format(start),
        end: format(end),
    };
}

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

type DashboardProps = {
    currentFund: number;
    matchCollection: {
        expected: number;
        received: number;
    };
    sponsorTotal: number;
    purchaseTotal: number;
    donationCount: number;
    activities: {
        date: string;
        amount: number;
        note: string | null;
    }[];
    matches: MatchRecord[];
    weeks: MatchWeek[];
    today: string;
};

export function Dashboard({
                              currentFund,
                              matchCollection,
                              sponsorTotal,
                              purchaseTotal,
                              matches,
                              weeks,
                              today,
                          }: DashboardProps) {

    const {view, navigate} = useDashboardNavigation();
    const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
    const selectedWeek = weeks[selectedWeekIndex];

    function selectOlderWeek() {
        setSelectedWeekIndex((index) =>
            Math.min(index + 1, weeks.length - 1),
        );
    }

    function selectNewerWeek() {
        setSelectedWeekIndex((index) =>
            Math.max(index - 1, 0),
        );
    }

    function navigateMatchCollection(
        mode: MatchCollectionMode,
        weekIndex?: number,
    ) {
        const url = new URL(window.location.href);

        url.searchParams.set("match", mode);

        if (weekIndex !== undefined) {
            url.searchParams.set("week", String(weekIndex));
        } else {
            url.searchParams.delete("week");
        }

        window.history.pushState({}, "", url);

        setMatchCollectionMode(mode);

        if (weekIndex !== undefined) {
            setSelectedWeekIndex(weekIndex);
        }
    }

    type MatchCollectionMode =
        | "recent"
        | "history"
        | "historical-week";

    const [matchCollectionMode, setMatchCollectionMode] =
        useState<MatchCollectionMode>("recent");

    useEffect(() => {
        const updateModeFromUrl = () => {
            const params = new URLSearchParams(window.location.search);
            const mode = params.get("match");

            if (
                mode === "history" ||
                mode === "historical-week"
            ) {
                setMatchCollectionMode(mode);
            } else {
                setMatchCollectionMode("recent");
            }

            const week = params.get("week");

            if (week !== null) {
                const index = Number(week);

                if (
                    Number.isInteger(index) &&
                    index >= 0 &&
                    index < weeks.length
                ) {
                    setSelectedWeekIndex(index);
                }
            } else {
                setSelectedWeekIndex(0);
            }
        };

        updateModeFromUrl();

        window.addEventListener("popstate", updateModeFromUrl);

        return () => {
            window.removeEventListener("popstate", updateModeFromUrl);
        };
    }, [weeks.length]);

    if (view !== "summary") {

        return (
            <div>
                {view === "matches" && selectedWeek && (
                    <>
                        {matchCollectionMode === "recent" && (
                            <div className="mt-2 flex items-center justify-between">
                                <div className="inline-flex rounded-lg bg-neutral-100 p-1">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedWeekIndex(0)}
                                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                            selectedWeekIndex === 0
                                                ? "bg-white text-blue-600 shadow-sm"
                                                : "text-neutral-500"
                                        }`}
                                    >
                                        This week
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSelectedWeekIndex(
                                                Math.min(1, weeks.length - 1),
                                            )
                                        }
                                        disabled={weeks.length < 2}
                                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                            selectedWeekIndex === 1
                                                ? "bg-white text-blue-600 shadow-sm"
                                                : "text-neutral-500"
                                        } disabled:cursor-not-allowed disabled:opacity-40`}
                                    >
                                        Last week
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setMatchCollectionMode("history")}
                                    className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                        className="h-6 w-6"
                                        aria-hidden="true"
                                    >
                                        <path d="M13 3a9 9 0 1 0 8.95 10h-2.02A7 7 0 1 1 13 5v3l4-4-4-4v3Zm-1 5v5l4.25 2.52.75-1.23-3.5-2.04V8H12Z" />
                                    </svg>
                                </button>
                            </div>
                        )}

                        {matchCollectionMode === "historical-week" && (
                            <>
                                <div className="mt-2 flex items-center justify-between rounded-lg bg-neutral-100 p-1">
                                    <button
                                        type="button"
                                        onClick={selectOlderWeek}
                                        disabled={selectedWeekIndex === weeks.length - 1}
                                        className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-white hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-30"
                                        aria-label="Older week"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="h-5 w-5"
                                            aria-hidden="true"
                                        >
                                            <path d="m15 18-6-6 6-6" />
                                        </svg>
                                    </button>

                                    <span className="text-sm font-medium text-neutral-700">
        {formatDateRange(
            selectedWeek.startDate,
            selectedWeek.endDate,
        ).start}

                                        <span className="mx-2 text-neutral-400">→</span>

                                        {formatDateRange(
                                            selectedWeek.startDate,
                                            selectedWeek.endDate,
                                        ).end}
    </span>

                                    <button
                                        type="button"
                                        onClick={selectNewerWeek}
                                        disabled={selectedWeekIndex === 0}
                                        className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-white hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-30"
                                        aria-label="Newer week"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="h-5 w-5"
                                            aria-hidden="true"
                                        >
                                            <path d="m9 18 6-6-6-6" />
                                        </svg>
                                    </button>
                                </div>

                                <MatchCollectionView week={selectedWeek} today={today}/>
                            </>
                        )}

                        {matchCollectionMode === "recent" && (
                            <MatchCollectionView week={selectedWeek} today={today}/>
                        )}

                        {matchCollectionMode === "history" && (
                            <div className="mt-4">
                                <div className="mb-3 px-1 text-lg font-medium text-neutral-500">
                                    History
                                </div>
                                <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                                    {weeks.map((week, index) => (
                                        <button
                                            key={`${week.startDate}-${week.endDate}`}
                                            type="button"
                                            onClick={() =>
                                                navigateMatchCollection(
                                                    "historical-week",
                                                    index,
                                                )
                                            }
                                            className="flex w-full items-center justify-between border-b border-neutral-100 px-5 py-4 text-left last:border-b-0"
                                        >
                                            <div className="flex items-center gap-2">
                                                {[
                                                    week.startDate,
                                                    week.endDate,
                                                ].map((date, index) => {
                                                    const value = new Date(`${date}T00:00:00Z`);
                                                    const day = value.getUTCDate();
                                                    const month = value.toLocaleDateString("en-IN", {
                                                        month: "short",
                                                        timeZone: "UTC",
                                                    });

                                                    return (
                                                        <span
                                                            key={date}
                                                            className="whitespace-nowrap"
                                                        >
                <span className="font-medium">
                    {day}
                    <sup className="ml-0.5 text-[9px] font-normal text-neutral-600">
                        {getOrdinalSuffix(day)}
                    </sup>
                </span>

                <span className="ml-1 font-normal text-neutral-700">

                    {month}
                </span>

                                                            {index === 0 && (
                                                                <svg
                                                                    xmlns="http://www.w3.org/2000/svg"
                                                                    viewBox="0 0 24 24"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    strokeWidth="1.5"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    style={{
                                                                        width: "18px",
                                                                        height: "18px",
                                                                        flexShrink: 0,
                                                                        display: "inline-block",
                                                                        marginLeft: "8px",
                                                                        marginRight: "8px",
                                                                        verticalAlign: "-4px",
                                                                    }}
                                                                    className="text-neutral-400"
                                                                    aria-hidden="true"
                                                                >
                                                                    <path d="M5 12h14" />
                                                                    <path d="m14 8 4 4-4 4" />
                                                                </svg>
                                                            )}
            </span>
                                                    );
                                                })}
                                            </div>

                                            <span className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-400 transition-all group-hover:bg-neutral-100 group-hover:text-neutral-800">
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6 transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
    >
        <path d="m9 18 6-6-6-6" />
    </svg>
</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="overflow-hidden">

        <header className="text-center">
                <img
                    src="/turfr-logo.svg"
                    alt="Turfr"
                    className="mx-auto block"
                    style={{ width: "100px", height: "auto" }}
                />

                <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-neutral-500">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="shrink-0"
                        style={{ width: "16px", height: "16px" }}
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z"
                        />
                        <circle cx="12" cy="9" r="2.25" />
                    </svg>

                    <span className="whitespace-nowrap">
            Ulwe, Navi Mumbai
        </span>
                </p>
            </header>

            <div className="mt-2 space-y-5">
                    <FundSummary amount={currentFund}/>
                <div className="mt-4">
                    <FundFlow
                        matchReceived={matchCollection.received}
                        sponsorTotal={sponsorTotal}
                        purchaseTotal={purchaseTotal}
                        onMatchCollectionClick={() => navigate("matches")}
                    />
                </div>
                <div className="mt-4 pb-1">
                    <MatchActivity
                        matches={matches}
                        today={today}
                    />
                </div>
            </div>

            <footer className="mt-1 text-center text-xs text-neutral-400"
            style={{                            fontFamily: "var(--font-jetbrains-mono)",
            }}>
                turfr|dash v1.0
            </footer>
        </div>
    );
}