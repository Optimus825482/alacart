import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Merit A La Carte - Lüks Restoran Yönetim Sistemi",
  description: "5 Yıldızlı Otel A La Carte Restoran, Garson ve Mutfak Yönetim Platformu",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="h-full bg-[#080c14] text-zinc-100" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-[#080c14] text-zinc-100" suppressHydrationWarning>
        <Navbar />
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
