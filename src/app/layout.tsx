import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "ALACARTE",
  description: "Alacarte Restoran Yönetim Sistemi",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ALACARTE",
  },
};

export const viewport = {
  themeColor: "#070a12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
