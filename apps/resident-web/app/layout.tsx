import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bancao Connect",
  description:
    "A digital service platform for Barangay Bancao-Bancao residents.",
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
