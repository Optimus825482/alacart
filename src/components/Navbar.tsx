"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UtensilsCrossed, ChefHat, Settings, Smartphone, Home } from "lucide-react";
import clsx from "clsx";

export function Navbar() {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Garson Terminali",
      href: "/waiter",
      icon: Smartphone,
      description: "Mobil Sipariş Terminali",
      badge: "Mobil",
    },
    {
      label: "Mutfak Ekranı (KDS)",
      href: "/kitchen",
      icon: ChefHat,
      description: "Sipariş Takip & Yazdırma",
      badge: "Canlı",
    },
    {
      label: "Tanımlar & Yönetim",
      href: "/admin",
      icon: Settings,
      description: "Alakart, Masa & Menü",
    },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#0d121f]/95 backdrop-blur-md border-b border-amber-500/20 px-4 lg:px-8 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <UtensilsCrossed className="w-5 h-5 text-zinc-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.25em] text-amber-400 font-semibold">
                MERİT HOTELS & RESORTS
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              A LA CARTE <span className="text-amber-400 font-normal text-xs px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/30">LÜKS OPERASYON</span>
            </h1>
          </div>
        </Link>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1.5 sm:gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all",
                  isActive
                    ? "bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/25 font-semibold"
                    : "text-zinc-300 hover:text-white hover:bg-zinc-800/60"
                )}
              >
                <Icon className={clsx("w-4 h-4", isActive ? "text-zinc-950" : "text-amber-400")} />
                <span className="hidden sm:inline">{item.label}</span>
                {item.badge && !isActive && (
                  <span className="hidden md:inline-block text-[10px] px-1.5 py-0.2 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
