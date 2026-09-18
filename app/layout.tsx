import type { Metadata } from "next";
import "./globals.css";
import { IBM_Plex_Mono, JetBrains_Mono } from "next/font/google";

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
  title: "Turfr — Community Funds",
  description: "Turfr community funds dashboard",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
      <html lang="en">
      <body
          className={`min-h-full ${ibmPlexMono.variable} ${jetBrainsMono.variable}`}
      >
      {children}
      </body>
      </html>
  );
}