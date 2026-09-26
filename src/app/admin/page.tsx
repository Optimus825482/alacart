import Link from "next/link";
import {
  UtensilsCrossed,
  Armchair,
  Layers,
  Users,
  ArrowRight,
  ChefHat,
  Shapes,
} from "lucide-react";
import { getRestaurants } from "@/actions/definitions";
import { getAdminDefinitionsSummary } from "@/actions/orders";

export default async function AdminDashboardPage() {
  const [summaryRes, restaurantsRes] = await Promise.all([
    getAdminDefinitionsSummary(),
    getRestaurants(),
  ]);

  const summary = summaryRes.data;
  const restaurants = restaurantsRes.data || [];

  const cards = [
    {
      label: "Tanımlı Alakart",
      value: summary?.totalRestaurants ?? 0,
      unit: "Restoran",
      tone: "text-amber-400",
    },
    {
      label: "Toplam Masa",
      value: summary?.totalTablesCount ?? 0,
      unit: "Tanımlı",
      tone: "text-amber-400",
    },
    {
      label: "Menü Grubu",
      value: summary?.totalCategoriesCount ?? 0,
      unit: "Kategori",
      tone: "text-amber-400",
    },
    {
      label: "Menü Öğesi",
      value: summary?.totalMenuItemsCount ?? 0,
      unit: "Ürün",
      tone: "text-amber-400",
    },
    {
      label: "Tanımlı Kullanıcı",
      value: summary?.totalUsersCount ?? 0,
      unit: "Aktif",
      tone: "text-amber-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <span className="text-xs uppercase tracking-wider text-amber-400 font-bold">
          SİSTEM YÖNETİCİSİ MODÜLÜ
        </span>
        <h2 className="text-2xl font-black text-white">Sistem Tanımları Genel Bakış</h2>
        <span className="text-xs text-zinc-400">
          Alakart restoranları, masa düzeni, menü yapısı ve kullanıcı tanımlamalarını buradan
          yönetin.
        </span>
      </div>

      {/* Tanım Özet Kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="p-4 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-lg"
          >
            <span className="text-zinc-400 text-xs block mb-1">{card.label}</span>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl sm:text-3xl font-extrabold ${card.tone}`}>
                {card.value}
              </span>
              <span className="text-xs text-zinc-500 font-medium">{card.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tanım Modülleri Hızlı Erişim */}
      <div>
        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">
          Tanım Modülleri
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/admin/restaurants"
            className="p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 hover:border-amber-500/40 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <UtensilsCrossed className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <span className="text-sm font-bold text-white block">Alakart Tanımları</span>
                <span className="text-[11px] text-zinc-500">{restaurants.length} restoran tanımlı</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-amber-400 transition-colors" />
          </Link>

          <Link
            href="/admin/tables"
            className="p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 hover:border-amber-500/40 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Armchair className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <span className="text-sm font-bold text-white block">Masa Tanımları</span>
                <span className="text-[11px] text-zinc-500">
                  {summary?.totalTablesCount ?? 0} masa tanımlı
                </span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-amber-400 transition-colors" />
          </Link>

          <Link
            href="/admin/menu"
            className="p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 hover:border-amber-500/40 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Layers className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <span className="text-sm font-bold text-white block">Menü &amp; Menü Grupları</span>
                <span className="text-[11px] text-zinc-500">
                  {summary?.totalCategoriesCount ?? 0} grup · {summary?.totalMenuItemsCount ?? 0}{" "}
                  ürün
                </span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-amber-400 transition-colors" />
          </Link>

          <Link
            href="/admin/users"
            className="p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 hover:border-amber-500/40 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <span className="text-sm font-bold text-white block">Kullanıcı Tanımları</span>
                <span className="text-[11px] text-zinc-500">
                  Roller, PIN ve alakart görevlendirme
                </span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-amber-400 transition-colors" />
          </Link>
        </div>
      </div>

      {/* Modül Sınırı Bilgilendirmesi */}
      <div className="p-5 rounded-3xl bg-zinc-900/50 border border-zinc-800">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
            <Shapes className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="flex-1">
            <span className="text-sm font-bold text-white block">Modül Sınırı</span>
            <span className="text-xs text-zinc-400">
              Bu ekranda yalnızca <strong className="text-zinc-300">tanımlar</strong> yapılır:
              kullanıcı, alakart restoran, masa, menü grubu ve menü öğesi tanımları. Canlı
              işleyiş, tüketim raporları, tarih aralığı analizleri, PDF/Excel çıktıları ve
              denetim izleri bu modülün kapsamına girmez.
            </span>
          </div>
        </div>
      </div>

      {/* Şef Modülüne Yönlendirme Notu */}
      <div className="p-5 rounded-3xl bg-purple-950/20 border border-purple-500/20 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center shrink-0">
          <ChefHat className="w-5 h-5 text-purple-400" />
        </div>
        <div className="flex-1">
          <span className="text-sm font-bold text-white block">Raporlar ve Denetim Logları</span>
          <span className="text-xs text-zinc-400">
            Tüketim raporları, tarih aralığı analizleri, PDF/Excel çıktıları ve denetim logları
            Şef Modülü&apos;nde bulunmaktadır.
          </span>
        </div>
        <Link
          href="/chef"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-xs font-bold whitespace-nowrap transition-all"
        >
          Şef Modülü
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
