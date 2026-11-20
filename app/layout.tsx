import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GMD Co-living PMS",
  description: "Property Management System for GMD Co-living Pvt Ltd",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
