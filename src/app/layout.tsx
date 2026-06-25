import type { Metadata } from "next";
import { Hanken_Grotesk, Schibsted_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// The design's type system: Hanken Grotesk (body), Schibsted Grotesk (display), IBM Plex Mono
// (numbers). Loaded here and exposed as CSS variables consumed by globals.css.
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Now You Know — understanding ServiceNow (NOW) stock",
  description:
    "A plain-English, independent, educational guide to ServiceNow (NOW) stock: why it moves, what today's price already assumes, and a model to pressure-test it. Not investment advice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="brand"
      data-accent="growth"
      className={`${hanken.variable} ${schibsted.variable} ${plexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
