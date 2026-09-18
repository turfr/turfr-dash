import {
    loadDonations,
    loadMatchCollection,
    loadPurchases,
    loadSponsors,
} from "./adapters/google-sheet";
import {DashboardData} from "@/lib/types";

export async function loadDashboardData(): Promise<DashboardData> {
    const [matches, sponsors, purchases, donations] = await Promise.all([
        loadMatchCollection(),
        loadSponsors(),
        loadPurchases(),
        loadDonations(),
    ]);

    return {
        matches,
        sponsors,
        purchases,
        donations,
    };
}