import type { ReactNode } from "react";
import { dseg7Classic, ibmPlexMono, ibmPlexSans } from "./fonts";

export default function ThreeKendLayout({ children }: Readonly<{ children: ReactNode }>) {
    return <div className={`${dseg7Classic.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>{children}</div>;
}
