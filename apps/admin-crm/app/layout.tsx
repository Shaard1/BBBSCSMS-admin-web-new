import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./workspace.css";

export const metadata: Metadata = {
  title: "Bancao Connect Admin",
  description: "Staff and administrator workspace for Barangay Bancao-Bancao.",
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
