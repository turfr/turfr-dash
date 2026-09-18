"use client";

import { useEffect, useState } from "react";

export type DashboardView =
    | "summary"
    | "matches"
    | "sponsors"
    | "purchases"
    | "donations";

function getViewFromUrl(): DashboardView {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");


    if (
        view === "matches" ||
        view === "sponsors" ||
        view === "purchases" ||
        view === "donations"
    ) {
        return view;
    }

    return "summary";
}

export function useDashboardNavigation() {
    const [view, setView] = useState<DashboardView>("summary");

    useEffect(() => {
        const handlePopState = () => {
            setView(getViewFromUrl());
        };

        setView(getViewFromUrl());

        window.addEventListener("popstate", handlePopState);

        return () => {
            window.removeEventListener("popstate", handlePopState);
        };
    }, []);

    function navigate(nextView: DashboardView) {
        const url = new URL(window.location.href);

        if (nextView === "summary") {
            url.searchParams.delete("view");
        } else {
            url.searchParams.set("view", nextView);
        }

        window.history.pushState({}, "", url);
        setView(nextView);
    }

    return {
        view,
        navigate,
    };
}