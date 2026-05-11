import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AuraCheck — AI Visibility Audit for Med Spas",
  description: "See how ChatGPT, Claude, and Perplexity rank your med spa. Free 30-second AI visibility check.",
  openGraph: {
    title: "AuraCheck — AI Visibility Audit for Med Spas",
    description: "See how ChatGPT, Claude, and Perplexity rank your med spa. Free 30-second AI visibility check.",
    url: "https://auracheck.aurafarmer.co",
    siteName: "AuraCheck",
    images: [
      {
        url: "https://auracheck.aurafarmer.co/og-image",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AuraCheck — AI Visibility Audit for Med Spas",
    description: "See how ChatGPT, Claude, and Perplexity rank your med spa.",
    images: ["https://auracheck.aurafarmer.co/og-image"],
  },
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
