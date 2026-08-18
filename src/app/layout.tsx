import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Artha | CA Practice Management",
  description: "Practice management software for Chartered Accountant firms in India.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
