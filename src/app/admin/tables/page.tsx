"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Armchair, X } from "lucide-react";
import {
  getTables,
  getRestaurants,
  createTable,
  updateTable,
  deleteTable,
} from "@/actions/definitions";

export default function AdminTablesPage() {
  const [tables, setTables] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedRestId, setSelectedRestId] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState(4);
  const [restaurantId, setRestaurantId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [tRes, rRes] = await Promise.all([
      getTables(selectedRestId !== "ALL" ? selectedRestId : undefined),
      getRestaurants(),
    ]);

    if (tRes.success && tRes.data) setTables(tRes.data);
    if (rRes.success && rRes.data) {
      setRestaurants(rRes.data);
      if (!restaurantId && rRes.data.length > 0) {
        setRestaurantId(rRes.data[0].id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedRestId]);

  const openCreateModal = () => {
    setEditingTable(null);
    setName("");
    setCapacity(4);
    if (selectedRestId !== "ALL") setRestaurantId(selectedRestId);
    setIsModalOpen(true);
  };

  const openEditModal = (t: any) => {
    setEditingTable(t);
    setName(t.name);
    setCapacity(t.capacity);
    setRestaurantId(t.restaurantId);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !restaurantId) return;

    setSubmitting(true);
    if (editingTable) {
      await updateTable(editingTable.id, { name, capacity, restaurantId });
    } else {
      await createTable({ name, capacity, restaurantId });
    }
    setSubmitting(false);
    setIsModalOpen(false);
    loadData();
  };

  const handleDelete = async (t: any) => {
    if (t.status === "OCCUPIED" || (t.orders && t.orders.length > 0)) {
      alert("Bu masada aktif siparişler bulunuyor. Lütfen önce siparişleri tamamlayın veya iptal edin.");
      return;
    }
    if (confirm(`"${t.name}" masasını silmek istediğinize emin misiniz?`)) {
      const res = await deleteTable(t.id);
      if (!res.success) {
        alert('Silme hatası: ' + (res.error || 'Bilinmeyen hata'));
      }
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs uppercase tracking-wider text-amber-400 font-bold">
            TANIMLAR
          </span>
          <h2 className="text-2xl font-black text-white">Masa Tanımları</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Restaurant Filter */}
          <select
            value={selectedRestId}
            onChange={(e) => setSelectedRestId(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 text-amber-300 text-xs sm:text-sm font-semibold rounded-xl px-3 py-2 focus:outline-none"
          >
            <option value="ALL">Tüm Alakartlar</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm shadow-md shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Masa Ekle</span>
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="p-12 text-center text-zinc-500">Yükleniyor...</div>
      ) : tables.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-zinc-900/40 border border-zinc-800 text-zinc-500 text-sm">
          Bu restoranda henüz tanımlı masa bulunmuyor.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {tables.map((t) => (
            <div
              key={t.id}
              className="p-4 rounded-2xl bg-[#0f1422] border border-zinc-800 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-amber-400 block truncate">
                    {t.restaurant?.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(t)}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                      title="Düzenle"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(t)}
                      className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400"
                      title="Sil"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <Armchair className="w-4 h-4 text-zinc-400" />
                  <h4 className="text-base font-extrabold text-white">{t.name}</h4>
                </div>
                <span className="text-xs text-zinc-400 block">
                  Kapasite: {t.capacity} Kişilik
                </span>
              </div>

              <div className="pt-3 border-t border-zinc-800/80 mt-3 text-[11px] text-zinc-500">
                Masa doluluğu / sipariş durumu bu ekranda gösterilmez; canlı işleyiş
                Şef Modülü&apos;nden izlenir.
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1422] border border-zinc-800 rounded-3xl max-w-sm w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <h3 className="text-base font-bold text-white">
                {editingTable ? "Masayı Düzenle" : "Yeni Masa Tanımı"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">
                  Alakart Restoran *
                </label>
                <select
                  value={restaurantId}
                  onChange={(e) => setRestaurantId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                >
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">
                  Masa Numarası / İsmi *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Masa 1, Teras 04, VIP Loca"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">
                  Kişi Kapasitesi
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={capacity}
                  onChange={(e) => setCapacity(parseInt(e.target.value) || 2)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold"
                >
                  {submitting ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
