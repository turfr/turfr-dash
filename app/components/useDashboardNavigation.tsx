"use client";

import {useEffect, useState} from "react";
import {DashboardView, getDashboardView} from "@/app/components/dashboardNavigation";


function getViewFromUrl(): DashboardView {
    const params = new URLSearchParams(window.location.search);
    return getDashboardView(params.get("view"));
}

export function useDashboardNavigation(initialView: DashboardView) {
    const [view, setView] = useState<DashboardView>(initialView);

    useEffect(() => {
        const handlePopState = () => {
            setView(getViewFromUrl());
        };

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