import Link from "next/link";
import {
  UtensilsCrossed,
  Armchair,
  Layers,
  Users,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { getAdminDashboardStats, getActiveKitchenOrders } from "@/actions/orders";
import { getRestaurants } from "@/actions/definitions";

export default async function AdminDashboardPage() {
  const [statsRes, activeOrdersRes, restaurantsRes] = await Promise.all([
    getAdminDashboardStats(),
    getActiveKitchenOrders(),
    getRestaurants(),
  ]);

  const stats = statsRes.data;
  const activeOrders = activeOrdersRes.data || [];
  const restaurants = restaurantsRes.data || [];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <span className="text-xs uppercase tracking-wider text-amber-400 font-bold">
          LÜKS OTEL YÖNETİMİ
        </span>
        <h2 className="text-2xl font-black text-white">Canlı Operasyon Özeti</h2>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-lg">
          <span className="text-zinc-400 text-xs block mb-1">Masa Doluluk Oranı</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-400">
              %{stats?.occupancyRate || 0}
            </span>
            <span className="text-xs text-zinc-500 font-medium">
              ({stats?.occupiedTablesCount || 0} / {stats?.totalTablesCount || 0})
            </span>
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-lg">
          <span className="text-zinc-400 text-xs block mb-1">Mutfakta Bekleyen</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-400">
              {stats?.activePendingOrders || 0}
            </span>
            <span className="text-xs text-zinc-500 font-medium">Yeni Sipariş</span>
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-lg">
          <span className="text-zinc-400 text-xs block mb-1">Hazırlanan Sipariş</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-blue-400">
              {stats?.activePreparingOrders || 0}
            </span>
            <span className="text-xs text-zinc-500 font-medium">Ocakta/Şefte</span>
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-lg">
          <span className="text-zinc-400 text-xs block mb-1">Bugün Toplam Sipariş</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
              {stats?.totalOrdersToday || 0}
            </span>
            <span className="text-xs text-zinc-500 font-medium">Servis Edilen</span>
          </div>
        </div>
      </div>

      {/* 2 Column Layout: Canlı Siparişler & Popüler Ürünler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Canlı Sipariş Monitörü */}
        <div className="p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Mutfaktaki Canlı Siparişler</span>
              </h3>
              <Link
                href="/kitchen"
                className="text-xs font-semibold text-amber-400 hover:underline flex items-center gap-1"
              >
                <span>Mutfak Ekranı</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {activeOrders.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 text-xs">
                Şu anda mutfakta bekleyen sipariş yok.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {activeOrders.slice(0, 6).map((order: any) => (
                  <div
                    key={order.id}
                    className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          {order.table?.name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20 font-semibold">
                          {order.restaurant?.name}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-400 block mt-0.5">
                        Garson: {order.waiter?.name} • {order.items?.length} Kalem
                      </span>
                    </div>

                    <span
                      className={`text-xs px-2.5 py-1 rounded-xl font-bold ${
                        order.status === "PENDING"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      }`}
                    >
                      {order.status === "PENDING" ? "Bekliyor" : "Hazırlanıyor"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* En Çok Tercih Edilen Yiyecek & İçecekler */}
        <div className="p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>En Çok Tercih Edilenler</span>
            </h3>
            <span className="text-xs text-zinc-500">Tüm Alakartlar</span>
          </div>

          {!stats?.popularItems || stats.popularItems.length === 0 ? (
            <div className="p-6 text-center text-zinc-500 text-xs">
              Henüz yeterli sipariş verisi oluşmadı.
            </div>
          ) : (
            <div className="space-y-2.5">
              {stats.popularItems.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/60 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-zinc-800 text-amber-400 font-bold text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <span className="text-xs font-bold text-white block">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        {item.categoryName}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-xl">
                    {item.totalCount} Porsiyon
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tanımlar Hızlı Erişim Menüsü */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href="/admin/restaurants"
          className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-amber-500/40 transition-all flex flex-col items-center text-center group"
        >
          <UtensilsCrossed className="w-6 h-6 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold text-white">Alakart Tanımları</span>
          <span className="text-[10px] text-zinc-500 mt-1">{restaurants.length} Restoran</span>
        </Link>

        <Link
          href="/admin/tables"
          className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-amber-500/40 transition-all flex flex-col items-center text-center group"
        >
          <Armchair className="w-6 h-6 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold text-white">Masa Tanımları</span>
          <span className="text-[10px] text-zinc-500 mt-1">{stats?.totalTablesCount || 0} Masa</span>
        </Link>

        <Link
          href="/admin/menu"
          className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-amber-500/40 transition-all flex flex-col items-center text-center group"
        >
          <Layers className="w-6 h-6 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold text-white">Menü & Kategoriler</span>
          <span className="text-[10px] text-zinc-500 mt-1">Ağaç Yapısı</span>
        </Link>

        <Link
          href="/admin/users"
          className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-amber-500/40 transition-all flex flex-col items-center text-center group"
        >
          <Users className="w-6 h-6 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold text-white">Garson & Kullanıcılar</span>
          <span className="text-[10px] text-zinc-500 mt-1">PIN Yönetimi</span>
        </Link>
      </div>
    </div>
  );
}
