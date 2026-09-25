"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Layers,
  Utensils,
  ChevronRight,
  FolderTree,
  X,
  Check,
  Search,
} from "lucide-react";
import {
  getCategoriesTree,
  createCategory,
  deleteCategory,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getRestaurants,
} from "@/actions/definitions";
import clsx from "clsx";

export default function AdminMenuPage() {
  const [categoriesTree, setCategoriesTree] = useState<any[]>([]);
  const [allCategoriesFlat, setAllCategoriesFlat] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedRestId, setSelectedRestId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Kategori Ekleme Modalı
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catParentId, setCatParentId] = useState<string>("");
  const [catDescription, setCatDescription] = useState("");

  // Ürün Ekleme / Düzenleme Modalı
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemAllergens, setItemAllergens] = useState("");
  const [itemImageUrl, setItemImageUrl] = useState("");
  const [itemCategoryId, setItemCategoryId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = async () => {
    setLoading(true);
    const [treeRes, restRes] = await Promise.all([
      getCategoriesTree(selectedRestId || undefined),
      getRestaurants(),
    ]);

    if (treeRes.success) {
      setCategoriesTree(treeRes.data || []);
      setAllCategoriesFlat(treeRes.allCategories || []);
      if (!itemCategoryId && treeRes.allCategories && treeRes.allCategories.length > 0) {
        setItemCategoryId(treeRes.allCategories[0].id);
      }
    }

    if (restRes.success && restRes.data) {
      setRestaurants(restRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedRestId]);

  // Kategori Ekle
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    setSubmitting(true);
    await createCategory({
      name: catName,
      description: catDescription,
      parentId: catParentId || null,
      restaurantId: selectedRestId || null,
    });
    setSubmitting(false);
    setIsCatModalOpen(false);
    setCatName("");
    setCatDescription("");
    setCatParentId("");
    loadData();
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (confirm(`"${name}" kategorisini ve altındaki tüm alt kategori ve ürünleri silmek istediğinize emin misiniz?`)) {
      await deleteCategory(id);
      loadData();
    }
  };

  // Ürün Ekle / Güncelle
  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !itemCategoryId) return;

    setSubmitting(true);
    if (editingItem) {
      await updateMenuItem(editingItem.id, {
        name: itemName,
        description: itemDescription,
        allergens: itemAllergens,
        imageUrl: itemImageUrl,
        categoryId: itemCategoryId,
      });
    } else {
      await createMenuItem({
        name: itemName,
        description: itemDescription,
        allergens: itemAllergens,
        imageUrl: itemImageUrl,
        categoryId: itemCategoryId,
      });
    }
    setSubmitting(false);
    setIsItemModalOpen(false);
    setItemName("");
    setItemDescription("");
    setItemAllergens("");
    setItemImageUrl("");
    loadData();
  };

  const openCreateItemModal = (preselectedCatId?: string) => {
    setEditingItem(null);
    setItemName("");
    setItemDescription("");
    setItemAllergens("");
    setItemImageUrl("");
    if (preselectedCatId) setItemCategoryId(preselectedCatId);
    setIsItemModalOpen(true);
  };

  const openEditItemModal = (item: any) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemDescription(item.description || "");
    setItemAllergens(item.allergens || "");
    setItemImageUrl(item.imageUrl || "");
    setItemCategoryId(item.categoryId);
    setIsItemModalOpen(true);
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (confirm(`"${name}" ürününü menüden kaldırmak istediğinize emin misiniz?`)) {
      await deleteMenuItem(id);
      loadData();
    }
  };

  // Hiyerarşik Kategori Ağacı Bileşeni (Recursive Tree Renderer)
  const renderCategoryNode = (category: any, level = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const hasItems = category.items && category.items.length > 0;

    return (
      <div key={category.id} className="space-y-2 mb-3">
        {/* Kategori Başlığı Satırı */}
        <div
          className={clsx(
            "p-3 rounded-2xl border flex items-center justify-between transition-all",
            level === 0
              ? "bg-[#131b2e] border-amber-500/40 shadow-sm"
              : level === 1
              ? "bg-[#0f1422] border-zinc-800 ml-4"
              : "bg-zinc-950/60 border-zinc-800/60 ml-8"
          )}
        >
          <div className="flex items-center gap-2">
            <FolderTree
              className={clsx(
                "w-4 h-4",
                level === 0 ? "text-amber-400 font-bold" : "text-zinc-400"
              )}
            />
            <span
              className={clsx(
                "font-bold text-white",
                level === 0 ? "text-sm sm:text-base text-amber-300" : "text-xs sm:text-sm"
              )}
            >
              {category.name}
            </span>
            <span className="text-[10px] text-zinc-500">
              ({category._count?.children || 0} Alt Kategori, {category._count?.items || 0} Ürün)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Alt Kategori Ekle Butonu */}
            <button
              onClick={() => {
                setCatParentId(category.id);
                setCatName("");
                setCatDescription("");
                setIsCatModalOpen(true);
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
              title="Bu kategoriye alt kategori ekle"
            >
              + Alt Kategori
            </button>

            {/* Ürün Ekle Butonu */}
            <button
              onClick={() => openCreateItemModal(category.id)}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium border border-amber-500/30"
              title="Bu kategoriye yemek/içecek ekle"
            >
              + Yemek Ekle
            </button>

            {/* Kategori Sil */}
            <button
              onClick={() => handleDeleteCategory(category.id, category.name)}
              className="p-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 text-rose-400"
              title="Kategoriyi Sil"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Kategorinin İçindeki Yemek/İçecek Öğeleri */}
        {hasItems && (
          <div className={clsx("grid grid-cols-1 sm:grid-cols-2 gap-2 my-2", level === 0 ? "ml-4" : level === 1 ? "ml-8" : "ml-12")}>
            {category.items.map((item: any) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-start justify-between gap-2"
              >
                <div>
                  <h5 className="text-xs font-bold text-white">{item.name}</h5>
                  {item.description && (
                    <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                      {item.description}
                    </p>
                  )}
                  {item.allergens && (
                    <span className="text-[9px] text-amber-400/80 bg-amber-400/10 px-1.5 py-0.2 rounded mt-1 inline-block">
                      Alerjen: {item.allergens}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEditItemModal(item)}
                    className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item.id, item.name)}
                    className="p-1 rounded bg-rose-950/40 text-rose-400 hover:text-rose-300"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Çocuk Kategoriler (Recursive Render) */}
        {hasChildren && (
          <div className="space-y-1">
            {category.children.map((child: any) =>
              renderCategoryNode(child, level + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs uppercase tracking-wider text-amber-400 font-bold">
            TANIMLAR
          </span>
          <h2 className="text-2xl font-black text-white">Menü & Hiyerarşik Kategoriler</h2>
          <span className="text-xs text-zinc-400">
            Kategori ➔ Alt Kategori ➔ Alt Kategori & Yemek/İçecek Tanımları (Fiyat Takibi Yoktur)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Ana Kategori Ekle */}
          <button
            onClick={() => {
              setCatParentId("");
              setCatName("");
              setCatDescription("");
              setIsCatModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Kök Kategori Ekle</span>
          </button>

          {/* Yemek / İçecek Ekle */}
          <button
            onClick={() => openCreateItemModal()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm shadow-md shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Yemek / İçecek Ekle</span>
          </button>
        </div>
      </div>

      {/* Ağaç Görünümü (Tree View) */}
      {loading ? (
        <div className="p-12 text-center text-zinc-500">Yükleniyor...</div>
      ) : categoriesTree.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-zinc-900/40 border border-zinc-800 text-zinc-500 text-sm">
          Henüz menü kategorisi tanımlanmamış. &quot;Kök Kategori Ekle&quot; butonuna basarak başlayabilirsiniz.
        </div>
      ) : (
        <div className="p-4 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl">
          {categoriesTree.map((rootCategory) =>
            renderCategoryNode(rootCategory, 0)
          )}
        </div>
      )}

      {/* Kategori Ekleme Modalı */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1422] border border-zinc-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <h3 className="text-base font-bold text-white">
                {catParentId ? "Alt Kategori Ekle" : "Yeni Kök Kategori Ekle"}
              </h3>
              <button
                onClick={() => setIsCatModalOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">
                  Üst Kategori (Hiyerarşi)
                </label>
                <select
                  value={catParentId}
                  onChange={(e) => setCatParentId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Ana Kategori (Kök: Örn: Yiyecekler / İçecekler) --</option>
                  {allCategoriesFlat.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">
                  Kategori Adı *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Başlangıçlar, Sıcak İçecekler, Şaraplar..."
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">
                  Açıklama (İsteğe Bağlı)
                </label>
                <input
                  type="text"
                  placeholder="Kategori hakkında kısa bilgi..."
                  value={catDescription}
                  onChange={(e) => setCatDescription(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold"
                >
                  {submitting ? "Ekleniyor..." : "Kategoriyi Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Yemek / İçecek Ekleme ve Düzenleme Modalı (KESİNLİKLE FİYAT YOKTUR) */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1422] border border-zinc-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  {editingItem ? "Yemek/İçecek Düzenle" : "Yeni Menü Öğesi Tanımla"}
                </h3>
                <span className="text-[10px] text-amber-400">
                  Lüks Otel Konsepti: Fiyat takibi bulunmamaktadır.
                </span>
              </div>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleItemSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">
                  Ait Olduğu Kategori *
                </label>
                <select
                  required
                  value={itemCategoryId}
                  onChange={(e) => setItemCategoryId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                >
                  {allCategoriesFlat.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">
                  Yemeğin / İçeceğin Adı *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Dry Aged T-Bone Steak, Burrata, Espresso..."
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">
                  Özellikleri, İçeriği & Sunumu
                </label>
                <textarea
                  placeholder="Örn: 28 gün dinlendirilmiş antrikot, trüflü patates püresi ve kuşkonmaz eşliğinde..."
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">
                  Alerjen Bilgisi (Varsa)
                </label>
                <input
                  type="text"
                  placeholder="Örn: Gluten, Laktoz, Kabuklu Deniz Mahsulleri, Ceviz..."
                  value={itemAllergens}
                  onChange={(e) => setItemAllergens(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">
                  Yemek / İçecek Fotoğrafı URL (Görsel Önizlemeli)
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/... (Görsel Web URL)"
                  value={itemImageUrl}
                  onChange={(e) => setItemImageUrl(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
                {itemImageUrl && (
                  <div className="mt-2 flex items-center gap-2 p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                    <img
                      src={itemImageUrl}
                      alt="Önizleme"
                      className="w-12 h-12 rounded-lg object-cover border border-zinc-700"
                    />
                    <span className="text-[10px] text-zinc-400">Görsel Önizleme Başarılı</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
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
