import Link from "next/link";
import { Smartphone, ChefHat, Settings, Utensils, CheckCircle2, ArrowRight, Sparkles, Printer, Layers } from "lucide-react";
import { getAdminDashboardStats } from "@/actions/orders";
import { getRestaurants } from "@/actions/definitions";

export default async function HomePage() {
  const [statsRes, restRes] = await Promise.all([
    getAdminDashboardStats(),
    getRestaurants(),
  ]);

  const stats = statsRes.data;
  const restaurants = restRes.data || [];

  return (
    <div className="flex-1 flex flex-col justify-between p-4 sm:p-8 max-w-7xl mx-auto w-full">
      {/* Hero Section */}
      <div className="py-8 sm:py-12 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-4 tracking-wider uppercase">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          5 Yıldızlı Ultra All-Inclusive Otel Operasyonu
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
          A La Carte Restoran <br />
          <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent">
            Yönetim & Mutfak Terminali
          </span>
        </h1>
        <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
          Müşteri arayüzü ve fiyatlandırma olmaksızın; garson masadan siparişi girer, mutfak ekranına (KDS) anlık düşer, termal adisyon yazıcıdan otomatik basılır ve şef tek tuşla siparişi tamamlar.
        </p>
      </div>

      {/* Live Operational Stats Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-sm">
          <span className="text-zinc-400 text-xs block mb-1">Aktif Alakart</span>
          <span className="text-2xl font-bold text-amber-400">{restaurants.length} Restoran</span>
        </div>
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-sm">
          <span className="text-zinc-400 text-xs block mb-1">Masa Kapasitesi</span>
          <span className="text-2xl font-bold text-white">{stats?.totalTablesCount || 0} Masa</span>
        </div>
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-sm">
          <span className="text-zinc-400 text-xs block mb-1">Bekleyen Sipariş</span>
          <span className="text-2xl font-bold text-amber-400">{stats?.activePendingOrders || 0} Adet</span>
        </div>
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-sm">
          <span className="text-zinc-400 text-xs block mb-1">Bugün Verilen</span>
          <span className="text-2xl font-bold text-emerald-400">{stats?.totalOrdersToday || 0} Sipariş</span>
        </div>
      </div>

      {/* 4 Main Action Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Module 1: Garson */}
        <Link
          href="/waiter"
          className="group relative p-5 rounded-3xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-zinc-800 hover:border-amber-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/10 flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400 group-hover:scale-110 transition-transform">
              <Smartphone className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20 mb-2 inline-block">
              MOBİL TERMİNAL
            </span>
            <h3 className="text-lg font-bold text-white mb-2 group-hover:text-amber-300 transition-colors">
              Garson Modülü
            </h3>
            <p className="text-zinc-400 text-xs leading-relaxed mb-4">
              Restoran kilidi, dokunmatik masa seçimi, fotoğraflı menüden talepleri girip mutfağa fırlatma.
            </p>
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-amber-400 pt-3 border-t border-zinc-800/80">
            <span>Terminali Aç</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
          </div>
        </Link>

        {/* Module 2: Mutfak (KDS) */}
        <Link
          href="/kitchen"
          className="group relative p-5 rounded-3xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-zinc-800 hover:border-emerald-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10 flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 text-emerald-400 group-hover:scale-110 transition-transform">
              <ChefHat className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-300 border border-emerald-400/20 mb-2 inline-block">
              TABLET & DESKTOP KDS
            </span>
            <h3 className="text-lg font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">
              Mutfak Ekranı
            </h3>
            <p className="text-zinc-400 text-xs leading-relaxed mb-4">
              İzole restoran mutfağı, sesli zil uyarısı, 80mm ESC/POS fiş çıktısı ve hazırlık zaman sayacı.
            </p>
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-400 pt-3 border-t border-zinc-800/80">
            <span>KDS Ekranını Aç</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
          </div>
        </Link>

        {/* Module 3: Şef Portalı */}
        <Link
          href="/chef"
          className="group relative p-5 rounded-3xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-zinc-800 hover:border-amber-400/50 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-400/10 flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400 group-hover:scale-110 transition-transform">
              <Sparkles className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20 mb-2 inline-block">
              BAŞ AŞÇI / ŞEF
            </span>
            <h3 className="text-lg font-bold text-white mb-2 group-hover:text-amber-300 transition-colors">
              Şef Koordinatör
            </h3>
            <p className="text-zinc-400 text-xs leading-relaxed mb-4">
              Çoklu alakart izleme, tarih aralıklı süre analitiği, Excel (.xlsx) ihracı ve denetim logları.
            </p>
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-amber-400 pt-3 border-t border-zinc-800/80">
            <span>Şef Portalına Git</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
          </div>
        </Link>

        {/* Module 4: Tanımlar & Yönetim */}
        <Link
          href="/admin"
          className="group relative p-5 rounded-3xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-zinc-800 hover:border-cyan-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/10 flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4 text-cyan-400 group-hover:scale-110 transition-transform">
              <Settings className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-400/10 text-cyan-300 border border-cyan-400/20 mb-2 inline-block">
              YÖNETİM & TANIMLAR
            </span>
            <h3 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
              Yönetim Paneli
            </h3>
            <p className="text-zinc-400 text-xs leading-relaxed mb-4">
              Alakartlar, masalar, hiyerarşik menü kategorileri, kullanıcı/garsonlar ve güvenlik logları.
            </p>
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-cyan-400 pt-3 border-t border-zinc-800/80">
            <span>Yönetim Paneline Git</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Feature Highlights Footer */}
      <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 flex flex-wrap items-center justify-around gap-4 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-amber-400" />
          <span>Fiyat ve Kasa Adımı Yok (Ultra All-Inclusive)</span>
        </div>
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-400" />
          <span>Sonsuz Hiyerarşik Kategori & Alt Kategori Ağacı</span>
        </div>
        <div className="flex items-center gap-2">
          <Printer className="w-4 h-4 text-amber-400" />
          <span>Termal Mutfak Fişi (80mm ESC/POS Slip)</span>
        </div>
      </div>
    </div>
  );
}
