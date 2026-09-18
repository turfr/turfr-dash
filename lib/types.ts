export type MatchRecord = {
    date: string;
    games: number;
    amountExpected: number;
    received: number;
    note: string | null;
};

export type Sponsor = {
    date: string | null;
    name: string;
    amount: number;
    proofUrl: string | null;
    note: string | null;
};

export type Purchase = {
    date: string | null;
    item: string;
    amount: number;
    proofUrl: string | null;
    note: string | null;
};

export type Donation = {
    date: string | null;
    donor: string;
    item: string;
    units: number;
    status: string;
    proofUrl: string | null;
    note: string | null;
};

export type DashboardData = {
    matches: MatchRecord[];
    sponsors: Sponsor[];
    purchases: Purchase[];
    donations: Donation[];
};