"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UtensilsCrossed,
  ChefHat,
  Settings,
  Smartphone,
  LogOut,
  User,
  Shield,
  Award,
} from "lucide-react";
import { getSessionUser, logoutAction, SessionUser } from "@/actions/auth";
import { getRestaurantTheme } from "@/lib/themes";
import clsx from "clsx";

export function Navbar() {
  const pathname = usePathname();
  const [session, setSession] = useState<SessionUser | null>(null);

  useEffect(() => {
    let iptal = false;
    async function loadSession() {
      if (iptal) return;
      const user = await getSessionUser();
      if (!iptal) setSession(user);
    }
    loadSession();
    // Alakart secildiginde navbar gostergesini aninda yenile
    const yenile = () => { loadSession(); };
    window.addEventListener("alacarte:session", yenile);
    return () => {
      iptal = true;
      window.removeEventListener("alacarte:session", yenile);
    };
  }, [pathname]);

  // Login sayfasında navbar gizlensin veya sade görünsün
  if (pathname === "/login") return null;

  // Rol bazlı gezinme linkleri
  const navItems = [];

  if (session?.role === "ADMIN" || session?.role === "WAITER") {
    navItems.push({
      label: "WAITER",
      href: "/waiter",
      icon: Smartphone,
      badge: "Mobil",
    });
  }

  if (session?.role === "ADMIN" || session?.role === "KITCHEN" || session?.role === "CHEF") {
    navItems.push({
      label: "KITCHEN",
      href: "/kitchen",
      icon: ChefHat,
      badge: "Mutfak",
    });
  }

  if (session?.role === "ADMIN" || session?.role === "CHEF") {
    navItems.push({
      label: "ŞEF",
      href: "/chef",
      icon: Award,
      badge: "Master KDS & Rapor",
    });
  }

  if (session?.role === "ADMIN") {
    navItems.push({
      label: "ADMIN",
      href: "/admin",
      icon: Settings,
      badge: "Admin",
    });
  }

  const logoHref = !session
    ? "/login"
    : session.role === "WAITER"
    ? "/waiter"
    : session.role === "KITCHEN"
    ? "/kitchen"
    : session.role === "CHEF"
    ? "/chef"
    : session.role === "ADMIN"
    ? "/admin"
    : "/login";

  return (
    <header className="sticky top-0 z-50 bg-[#070a12]/95 backdrop-blur-md border-b border-amber-500/20 px-3 sm:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand */}
        <Link href={logoHref} title="Ana Ekran / Modül Girişi" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <UtensilsCrossed className="w-4 h-4 text-zinc-950 font-bold" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-black tracking-widest text-white group-hover:text-amber-400 transition-colors">
              ALACARTE
            </h1>
          </div>
        </Link>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                  isActive
                    ? "bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/25 font-bold"
                    : "text-zinc-300 hover:text-white hover:bg-zinc-800/60"
                )}
              >
                <Icon className={clsx("w-3.5 h-3.5", isActive ? "text-zinc-950" : "text-amber-400")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Seçilen Alakart Göstergesi */}
        {session?.activeRestaurantName && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-amber-400/90 hidden lg:inline">Seçilen Alakart:</span>
            <span className="font-extrabold text-amber-300 text-xs sm:text-sm">{session.activeRestaurantName}</span>
          </div>
        )}

        {/* Right User & Logout Section */}
        <div className="flex items-center gap-2">
          {session ? (
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <span className="text-xs font-bold text-white block leading-tight">
                  {session.name}
                </span>
                <span className="text-[10px] text-amber-400 font-mono">
                  {session.role}
                </span>
              </div>

              <form action={logoutAction}>
                <button
                  type="submit"
                  title="Güvenli Çıkış Yap"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-xs font-bold transition-all active:scale-95"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Çıkış</span>
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-md shadow-amber-500/20"
            >
              <User className="w-3.5 h-3.5" />
              <span>Giriş Yap</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
