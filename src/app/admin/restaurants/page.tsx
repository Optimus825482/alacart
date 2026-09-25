"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Check, X, UtensilsCrossed } from "lucide-react";
import {
  getRestaurants,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
} from "@/actions/definitions";

export default function AdminRestaurantsPage() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<any | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const res = await getRestaurants();
    if (res.success && res.data) {
      setRestaurants(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingRestaurant(null);
    setName("");
    setCode("");
    setDescription("");
    setIsModalOpen(true);
  };

  const openEditModal = (r: any) => {
    setEditingRestaurant(r);
    setName(r.name);
    setCode(r.code);
    setDescription(r.description || "");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    setSubmitting(true);
    if (editingRestaurant) {
      await updateRestaurant(editingRestaurant.id, { name, code, description });
    } else {
      await createRestaurant({ name, code, description });
    }
    setSubmitting(false);
    setIsModalOpen(false);
    loadData();
  };

  const handleDelete = async (id: string, rName: string) => {
    if (confirm(`"${rName}" restoranını ve buna bağlı tüm masa ve siparişleri silmek istediğinize emin misiniz?`)) {
      await deleteRestaurant(id);
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs uppercase tracking-wider text-amber-400 font-bold">
            TANIMLAR
          </span>
          <h2 className="text-2xl font-black text-white">Alakart Restoranlar</h2>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm shadow-md shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Yeni Alakart Ekle</span>
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="p-12 text-center text-zinc-500">Yükleniyor...</div>
      ) : restaurants.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-zinc-900/40 border border-zinc-800 text-zinc-500 text-sm">
          Henüz tanımlı bir alakart restoran bulunmuyor.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {restaurants.map((r) => (
            <div
              key={r.id}
              className="p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <UtensilsCrossed className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{r.name}</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-amber-300">
                        {r.code}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(r)}
                      className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white"
                      title="Düzenle"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(r.id, r.name)}
                      className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-300"
                      title="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-zinc-400 text-xs mt-3 leading-relaxed">
                  {r.description || "Açıklama belirtilmemiş."}
                </p>
              </div>

              <div className="pt-4 border-t border-zinc-800/80 mt-4 flex items-center justify-between text-xs text-zinc-400">
                <span>{r.tablesCount || 0} Tanımlı Masa</span>
                <span className="text-emerald-400 font-semibold">Aktif</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1422] border border-zinc-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <h3 className="text-base font-bold text-white">
                {editingRestaurant ? "Alakart Restoranı Düzenle" : "Yeni Alakart Restoran"}
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
                  Restoran Adı *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Bella Vista İtalyan A La Carte"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">
                  Kısa Kod (Benzersiz) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: ITALIAN, FISH, STEAK"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white uppercase focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">
                  Açıklama / Mutfak Konsepti
                </label>
                <textarea
                  placeholder="Özel şarap menüsü, taze makarna ve Akdeniz lezzetleri..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
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
