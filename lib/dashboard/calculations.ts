import { MatchRecord, Purchase, Sponsor } from "@/lib/types";

export function calculateMatchCollection(matches: MatchRecord[]) {
    const expected = matches.reduce(
        (sum, match) => sum + match.amountExpected,
        0,
    );

    const received = matches.reduce(
        (sum, match) => sum + match.received,
        0,
    );

    return {
        expected,
        received,
        difference: received - expected,
    };
}

export function calculateCurrentFund(
    matches: MatchRecord[],
    sponsors: Sponsor[],
    purchases: Purchase[],
) {
    const matchReceived = matches.reduce(
        (sum, match) => sum + match.received,
        0,
    );

    const sponsorContributions = sponsors.reduce(
        (sum, sponsor) => sum + sponsor.amount,
        0,
    );

    const purchasesTotal = purchases.reduce(
        (sum, purchase) => sum + purchase.amount,
        0,
    );

    return matchReceived + sponsorContributions - purchasesTotal;
}

export function calculateWeekCollection(matches: MatchRecord[]) {
    const expected = matches.reduce(
        (sum, match) => sum + match.amountExpected,
        0,
    );

    const received = matches.reduce(
        (sum, match) => sum + match.received,
        0,
    );

    return {
        expected,
        received,
        difference: received - expected,
    };
}