import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bancao Connect Admin",
  description:
    "Staff and administrator workspace for Barangay Bancao-Bancao.",
  icons: {
    icon: "/assets/BBBCSMS App Icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
