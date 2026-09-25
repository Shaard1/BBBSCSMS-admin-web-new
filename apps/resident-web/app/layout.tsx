import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bancao Connect | Barangay Bancao-Bancao Resident Services",
  description:
    "Explore barangay services, learn how to request documents and report community concerns, and download the Bancao Connect Android app for residents of Bancao-Bancao, Puerto Princesa City.",
  icons: {
    icon: "/assets/bancao-connect-mark-community.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
