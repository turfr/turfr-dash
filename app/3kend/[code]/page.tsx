import type { Metadata } from "next";
import { SessionConsole } from "../SessionConsole";

export const metadata: Metadata = {
    title: "3Kend | Turfr",
    description: "Live 3Kend football session.",
};

export default async function ThreeKendSessionPage({
    params,
}: { params: Promise<{ code: string }> }) {
    const { code } = await params;
    return <SessionConsole code={code} />;
}
