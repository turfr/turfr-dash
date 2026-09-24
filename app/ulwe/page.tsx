import {calculateCurrentFund, calculateMatchCollection} from "@/lib/dashboard/calculations";
import {loadDashboardData} from "@/lib/dashboard/data";
import {getCurrentWeek, groupMatchesByWeek} from "@/lib/dashboard/grouping";
import {Dashboard} from "@/app/components/Dashboard";
import {getDashboardView} from "@/app/components/dashboardNavigation";

export const dynamic = "force-dynamic";

export default async function Home({
                                       searchParams,
                                   } : { searchParams: Promise<{view? :string}>;
                                }) {

    const params = await searchParams;
    const initialView = getDashboardView(params.view ?? null);

    const data = await loadDashboardData();
    const weeks = groupMatchesByWeek(data.matches);

    const today = new Date().toISOString().slice(0, 10);
    const currentWeek = getCurrentWeek();

    const displayWeeks = weeks.some(
        (week) => week.startDate === currentWeek.startDate,
    )
        ? weeks
        : [currentWeek, ...weeks];

    const matchCollection = calculateMatchCollection(data.matches);

    const currentFund = calculateCurrentFund(
        data.matches,
        data.sponsors,
        data.purchases,
    );

    const sponsorTotal = data.sponsors.reduce(
        (sum, sponsor) => sum + sponsor.amount,
        0,
    );

    const purchaseTotal = data.purchases.reduce(
        (sum, purchase) => sum + purchase.amount,
        0,
    );

    const activities = data.matches.slice(-5).reverse().map((match) => ({
        date: match.date,
        amount: match.received,
        note: match.note,
    }));

    return (
        <main className="mx-auto max-w-2xl px-4 pt-2 py-4 sm:px-6 sm:py-6">
            <Dashboard
                initialView={initialView}
                currentFund={currentFund}
                matchCollection={matchCollection}
                sponsorTotal={sponsorTotal}
                purchaseTotal={purchaseTotal}
                donationCount={data.donations.length}
                activities={activities}
                matches={data.matches}
                weeks={displayWeeks}
                today={today}
            />
        </main>
    );
}