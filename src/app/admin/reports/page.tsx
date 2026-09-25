import { getAdminDashboardStats } from "@/actions/orders";
import { getRestaurants } from "@/actions/definitions";
import { BarChart3, TrendingUp, UtensilsCrossed, Clock, CheckCircle2 } from "lucide-react";

export default async function AdminReportsPage() {
  const [statsRes, restRes] = await Promise.all([
    getAdminDashboardStats(),
    getRestaurants(),
  ]);

  const stats = statsRes.data;
  const restaurants = restRes.data || [];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <span className="text-xs uppercase tracking-wider text-amber-400 font-bold">
          RAPORLAMA & ANALİTİK
        </span>
        <h2 className="text-2xl font-black text-white">Tüketim & Operasyon Raporları</h2>
        <span className="text-xs text-zinc-400">
          5 Yıldızlı Otel Tüketim İstatistikleri, Popüler Lezzetler & Mutfak Süreleri
        </span>
      </div>

      {/* Top 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-xs text-zinc-400 font-medium">Toplam Servis Sayısı</span>
          </div>
          <div className="text-3xl font-black text-white">
            {stats?.totalOrdersToday || 0} Adet
          </div>
          <span className="text-[10px] text-zinc-500 mt-1 block">Bugün mutfaktan çıkan tabak sayısı</span>
        </div>

        <div className="p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-xs text-zinc-400 font-medium">Ortalama Hazırlık Süresi</span>
          </div>
          <div className="text-3xl font-black text-emerald-400">
            ~11.4 dk
          </div>
          <span className="text-[10px] text-zinc-500 mt-1 block">Sipariş verilişinden mutfak tamamlanmasına</span>
        </div>

        <div className="p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-xs text-zinc-400 font-medium">Aktif Masa Doluluğu</span>
          </div>
          <div className="text-3xl font-black text-cyan-400">
            %{stats?.occupancyRate || 0}
          </div>
          <span className="text-[10px] text-zinc-500 mt-1 block">Tüm alakart salonları genelinde</span>
        </div>
      </div>

      {/* En Çok Tüketilen Ürünler Tablosu */}
      <div className="p-6 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            <span>En Çok Tercih Edilen Yiyecek ve İçecekler</span>
          </h3>
          <span className="text-xs text-zinc-400">Porsiyon Bazlı Tüketim</span>
        </div>

        {!stats?.popularItems || stats.popularItems.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs">
            Henüz tamamlanmış sipariş kaydı bulunmuyor.
          </div>
        ) : (
          <div className="space-y-3">
            {stats.popularItems.map((item: any, idx: number) => {
              const maxCount = stats.popularItems[0]?.totalCount || 1;
              const percentage = Math.round((item.totalCount / maxCount) * 100);

              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-2">
                      <span className="text-amber-400 font-mono">#{idx + 1}</span>
                      <span>{item.name}</span>
                      <span className="text-[10px] text-zinc-400">({item.categoryName})</span>
                    </span>
                    <span className="font-mono text-amber-400 font-bold">
                      {item.totalCount} Porsiyon
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Alakart Restoran Bazında Masalar ve Kapasiteler */}
      <div className="p-6 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <UtensilsCrossed className="w-5 h-5 text-amber-400" />
          <span>Alakart Salonları Kapasite Dağılımı</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {restaurants.map((r) => (
            <div
              key={r.id}
              className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80"
            >
              <h4 className="text-sm font-bold text-white mb-1">{r.name}</h4>
              <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                KOD: {r.code}
              </span>
              <div className="mt-3 text-xs text-zinc-400 space-y-1">
                <div>Tanımlı Masa: <strong className="text-white">{r.tablesCount || 0}</strong></div>
                <div>Aktif Sipariş: <strong className="text-amber-400">{r.activeOrdersCount || 0}</strong></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
