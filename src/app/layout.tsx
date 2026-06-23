import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DisclaimerBanner, DisclaimerFooter } from "@/components/Disclaimers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NOW Insight — understanding ServiceNow (NOW) stock",
  description:
    "An independent, educational tool for understanding ServiceNow (NOW) stock: what today's price implies about the market's expectations. Not investment advice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Required on every page (CLAUDE.md hard rule). */}
        <DisclaimerBanner />
        <main className="flex-1 w-full">{children}</main>
        <DisclaimerFooter />
      </body>
    </html>
  );
}
