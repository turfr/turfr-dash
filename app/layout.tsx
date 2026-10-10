import type { Metadata } from "next";
import "./globals.css";
import { IBM_Plex_Mono, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";

const ibmPlexSans = IBM_Plex_Sans({
    variable: "--font-ibm-plex-sans",
    subsets: ["latin"],
    weight: ["400", "500", "600"],
});

const ibmPlexMono = IBM_Plex_Mono({
    variable: "--font-ibm-plex-mono",
    subsets: ["latin"],
    weight: ["400", "500", "600"],
});

const jetBrainsMono = JetBrains_Mono({
    variable: "--font-jetbrains-mono",
    subsets: ["latin"],
    weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
    title: "Ulwe Footballers",
    description: "Ulwe Footballers community dashboard",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
      <html lang="en">
      <body
          className={`min-h-full ${ibmPlexSans.variable} ${ibmPlexMono.variable} ${jetBrainsMono.variable}`}
      >
      {children}
      </body>
      </html>
  );
}
