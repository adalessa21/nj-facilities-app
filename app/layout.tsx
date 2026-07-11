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
  title: "NJ Facilities Procurement Platform — Cooperative Contract Search for NJ Public Institutions",
  description: "Search cooperative contracts from ESCNJ, NJ State Contract, Sourcewell, OMNIA, Bergen Co-op, and more for NJ public colleges, universities, and county governments.",
  verification: {
    google: 'KTT03CEJSbMyyHapTkkSqwPCwil1orrrt7jlEpxDrxM',
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
