import type { Metadata } from "next";
import { InviteAccept } from "../../InviteAccept";

export const metadata: Metadata = {
    title: "Accept 3kend Timekeeper Invite | Turfr",
    robots: { index: false, follow: false },
};

export default async function InvitePage({
    params,
}: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    return <InviteAccept token={token} />;
}
