"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Layers,
  Users,
  BarChart3,
  Armchair,
  Shield,
} from "lucide-react";
import clsx from "clsx";

export function AdminSidebar() {
  const pathname = usePathname();

  const links = [
    { href: "/admin", label: "Genel Bakış", icon: LayoutDashboard, exact: true },
    { href: "/admin/restaurants", label: "Alakart Tanımları", icon: UtensilsCrossed },
    { href: "/admin/tables", label: "Masa Tanımları", icon: Armchair },
    { href: "/admin/menu", label: "Menü & Hiyerarşik Kategoriler", icon: Layers },
    { href: "/admin/users", label: "Kullanıcı & Garson Tanımları", icon: Users },
    { href: "/admin/reports", label: "Tüketim Raporları", icon: BarChart3 },
    { href: "/admin/audit", label: "Denetim Logları", icon: Shield },
  ];

  return (
    <aside className="w-full md:w-64 shrink-0">
      <div className="bg-[#0f1422] border border-zinc-800 rounded-3xl p-4 sticky top-20 shadow-xl">
        <div className="px-3 py-2 mb-3 border-b border-zinc-800/80">
          <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 block">
            YÖNETİM MODÜLÜ
          </span>
          <h2 className="text-sm font-extrabold text-white">Sistem Tanımları</h2>
        </div>

        <nav className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = link.exact
              ? pathname === link.href
              : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all",
                  isActive
                    ? "bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20 font-bold"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                )}
              >
                <Icon className={clsx("w-4 h-4", isActive ? "text-zinc-950" : "text-amber-400")} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
