import { parse } from "csv-parse/sync";
import {Donation, MatchRecord, Purchase, Sponsor} from "@/lib/types";

const BASE_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSBT6YenN6AZGe3HerCW1QWTdbYKphBCRGBGWqr_3__5G7JuT8vpztr7PT3QkQlzp0J5LXKTq4hTKWZ/pub";

const SHEET_URLS = {
    matchCollection: `${BASE_URL}?gid=473929190&single=true&output=csv`,
    sponsors: `${BASE_URL}?gid=500727844&single=true&output=csv`,
    purchases: `${BASE_URL}?gid=1311794507&single=true&output=csv`,
    donations: `${BASE_URL}?gid=1986299708&single=true&output=csv`,
};

type CsvRow = Record<string, string>;

async function fetchRows(url: string): Promise<CsvRow[]> {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            `Failed to fetch published sheet: ${response.status} ${response.statusText}`,
        );
    }

    const csv = await response.text();

    return parse(csv, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    }) as CsvRow[];
}

function parseRupees(value: string): number {
    return Number(value.replace(/[₹,\s]/g, ""));
}

function nullable(value: string): string | null {
    return value || null;
}

export async function loadMatchCollection(): Promise<MatchRecord[]> {
    const rows = await fetchRows(SHEET_URLS.matchCollection);

    return rows.map((row) => ({
        date: parseDate(row.Date),
        games: Number(row.Games),
        amountExpected: parseRupees(row["Amount Expected"]),
        received: parseRupees(row.Received),
        note: nullable(row.Note),
    }));
}

export async function loadSponsors(): Promise<Sponsor[]> {
    const rows = await fetchRows(SHEET_URLS.sponsors);

    return rows.map((row) => ({
        date: nullable(row.Date),
        name: row.Sponsor,
        amount: parseRupees(row.Amount),
        proofUrl: nullable(row["Proof URL"]),
        note: nullable(row.Note),
    }));
}

export async function loadPurchases(): Promise<Purchase[]> {
    const rows = await fetchRows(SHEET_URLS.purchases);

    return rows.map((row) => ({
        date: nullable(row.Date),
        item: row.Item,
        amount: parseRupees(row.Amount),
        proofUrl: nullable(row["Proof URL"]),
        note: nullable(row.Note),
    }));
}

export async function loadDonations(): Promise<Donation[]> {
    const rows = await fetchRows(SHEET_URLS.donations);

    return rows.map((row) => ({
        date: nullable(row.Date),
        donor: row.Donor,
        item: row.Item,
        units: Number(row.Units),
        status: row.Status,
        proofUrl: nullable(row["Proof URL"]),
        note: nullable(row.Note),
    }));
}

function parseDate(value: string): string {
    const [day, month, year] = value.split("-");

    return `${year}-${month}-${day}`;
}