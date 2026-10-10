import localFont from "next/font/local";

export const dseg7Classic = localFont({
    src: "../../public/fonts/DSEG7Classic-Regular.woff2",
    variable: "--font-dseg7-classic",
    display: "block",
    preload: true,
});

// Keep 3Kend's chosen supporting typefaces local. next/font/google's dev
// fallback can resolve to the operating system's Arial differently on phones.
export const ibmPlexSans = localFont({
    src: "../../public/fonts/IBMPlexSans-Latin.woff2",
    variable: "--font-ibm-plex-sans",
    weight: "400 600",
    display: "swap",
    preload: true,
});

export const ibmPlexMono = localFont({
    src: [
        { path: "../../public/fonts/IBMPlexMono-Latin-400.woff2", weight: "400" },
        { path: "../../public/fonts/IBMPlexMono-Latin-500.woff2", weight: "500" },
        { path: "../../public/fonts/IBMPlexMono-Latin-600.woff2", weight: "600" },
    ],
    variable: "--font-ibm-plex-mono",
    display: "swap",
    preload: true,
});
