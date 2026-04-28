import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Layout/Header";
import { Footer } from "@/components/Layout/Footer";

export const metadata: Metadata = {
  title: "AI Scorecard",
  description: "Automated AI adoption scorecard for engineering leaders",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-slate-900 text-white antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
