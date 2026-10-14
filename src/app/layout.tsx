import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ALACARTE · Restoran POS Sistemi",
  applicationName: "Alacarte POS",
  description:
    "MICROS Simphony TSR standartlarında Restoran Operasyon ve Sipariş Yönetim Sistemi.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Alacarte POS",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#101819",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="tr"
      className="h-full bg-[#101819] text-[#f0f5f3]"
      suppressHydrationWarning
    >
      <body
        className="min-h-dvh flex flex-col bg-[#101819] text-[#f0f5f3] selection:bg-[#73d8c6] selection:text-[#10201e]"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
