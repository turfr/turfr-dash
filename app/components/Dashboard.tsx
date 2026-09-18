"use client";

import {useState} from "react";
import {ActivityList} from "./ActivityList";
import {FundSummary} from "./FundSummary";
import {SummaryRow} from "./SummaryRow";
import {useDashboardNavigation} from "@/app/components/useDashboardNavigation";
import {MatchRecord} from "@/lib/types";
import {MatchCollectionView} from "@/app/components/MatchCollectionView";
import {MatchWeek} from "@/lib/dashboard/grouping";
import {FundCard} from "@/app/components/FundCard";
import {FundFlow} from "@/app/components/FundFlow";
import {MatchActivity} from "@/app/components/MatchActivity";

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
                              donationCount,
                              activities,
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

    type MatchCollectionMode =
        | "recent"
        | "history"
        | "historical-week";

    const [matchCollectionMode, setMatchCollectionMode] =
        useState<MatchCollectionMode>("recent");

    const firstRecordedDate = matches
        .map((match) => match.date)
        .sort()[0];

    if (view !== "summary") {
        return (
            <div>
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-semibold tracking-tight">
                            Match Collection
                    </h1>

                    {matchCollectionMode === "recent" && (
                        <button
                            type="button"
                            aria-label="History"
                            onClick={() => setMatchCollectionMode("history")}
                            className="text-lg text-neutral-500"
                        >
                            ◷
                        </button>
                    )}
                </div>
                {view === "matches" && selectedWeek && (
                    <>
                        {matchCollectionMode === "recent" && (
                            <div className="mt-4 flex items-center justify-between">
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
                                    aria-label="History"
                                    onClick={() => setMatchCollectionMode("history")}
                                    className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                                >
                                    ◷
                                </button>
                            </div>
                        )}

                        {matchCollectionMode === "historical-week" && (
                            <>
                                <div>
                                    <button
                                        type="button"
                                        onClick={selectOlderWeek}
                                        disabled={selectedWeekIndex === weeks.length - 1}
                                    >
                                        &lt;
                                    </button>

                                    <span>
                                        {selectedWeek.startDate} → {selectedWeek.endDate}
                                    </span>

                                    <button
                                        type="button"
                                        onClick={selectNewerWeek}
                                        disabled={selectedWeekIndex === 0}
                                    >
                                        &gt;
                                    </button>
                                </div>

                                <MatchCollectionView week={selectedWeek} today={today}/>
                            </>
                        )}

                        {matchCollectionMode === "recent" && (
                            <MatchCollectionView week={selectedWeek} today={today}/>
                        )}
                    </>
                )}
            </div>
        );
    }

    return (
        <>
            <header className="text-center">
                <img
                    src="/turfr-logo.svg"
                    alt="Turfr"
                    className="mx-auto block"
                    style={{ width: "100px", height: "auto" }}
                />

                <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-neutral-500">
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

                {/*<section className="mt-1">*/}

                {/*    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">*/}
                {/*        <FundCard*/}
                {/*            title="Match Collection"*/}
                {/*            value={`₹${matchCollection.received.toLocaleString("en-IN")}`}*/}
                {/*            subtitle={`₹${matchCollection.expected.toLocaleString("en-IN")} expected`}*/}
                {/*            onClick={() => navigate("matches")}*/}
                {/*        />*/}

                {/*        <FundCard*/}
                {/*            title="Sponsors"*/}
                {/*            value={`₹${sponsorTotal.toLocaleString("en-IN")}`}*/}
                {/*            onClick={() => navigate("sponsors")}*/}
                {/*        />*/}

                {/*        <FundCard*/}
                {/*            title="Purchases"*/}
                {/*            value={`₹${purchaseTotal.toLocaleString("en-IN")}`}*/}
                {/*            onClick={() => navigate("purchases")}*/}
                {/*        />*/}

                {/*        <FundCard*/}
                {/*            title="Donations"*/}
                {/*            value={`${donationCount}`}*/}
                {/*            subtitle="items"*/}
                {/*            onClick={() => navigate("donations")}*/}
                {/*        />*/}
                {/*    </div>*/}
                {/*</section>*/}
                <div className="mt-4">
                    <FundFlow
                        matchReceived={matchCollection.received}
                        sponsorTotal={sponsorTotal}
                        purchaseTotal={purchaseTotal}
                    />
                </div>
                {/* ACTIVITY */}
                {/*<div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">*/}
                {/*    <ActivityList activities={activities}/>*/}
                {/*</div>*/}
                <div className="mt-4">
                    <MatchActivity
                        matches={matches}
                        today={today}
                    />
                </div>
            </div>

            <footer className="mt-3 text-center text-xs text-neutral-400"
            style={{                            fontFamily: "var(--font-jetbrains-mono)",
            }}>
                turfr|dash v1.0
            </footer>
        </>
    );
}