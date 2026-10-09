import type { Metadata } from "next";
import { AdminSetup } from "./setup";

export const metadata: Metadata = {
    title: "3Kend Session Setup | Turfr",
    robots: { index: false, follow: false },
};

export default function ThreeKendAdminPage() {
    return <AdminSetup />;
}
