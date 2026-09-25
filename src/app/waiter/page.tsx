"use client";

import { useState, useEffect } from "react";
import {
  Utensils,
  Coffee,
  Check,
  Plus,
  Minus,
  Send,
  AlertCircle,
  Clock,
  ChevronRight,
  Info,
  Sparkles,
  ShoppingBag,
  X,
  UserCheck,
  RotateCcw,
} from "lucide-react";
import { getRestaurants, getTables, getCategoriesTree, getUsers } from "@/actions/definitions";
import { createOrder, getTableActiveOrders } from "@/actions/orders";
import clsx from "clsx";

interface CartItem {
  menuItemId: string;
  name: string;
  quantity: number;
  itemNotes: string;
  categoryName?: string;
}

export default function WaiterTerminalPage() {
  const [loading, setLoading] = useState(true);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>("");
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [waiters, setWaiters] = useState<any[]>([]);
  const [selectedWaiterId, setSelectedWaiterId] = useState<string>("");

  // Hiyerarşik Kategori Navigasyonu
  const [categoriesTree, setCategoriesTree] = useState<any[]>([]);
  const [selectedRootCatId, setSelectedRootCatId] = useState<string>("");
  const [selectedSubCatId, setSelectedSubCatId] = useState<string>("");
  const [selectedSubSubCatId, setSelectedSubSubCatId] = useState<string>("");

  // Arama & Filtreleme
  const [searchQuery, setSearchQuery] = useState("");

  // Sepet & Sipariş State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [generalOrderNotes, setGeneralOrderNotes] = useState("");
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [activeTableOrders, setActiveTableOrders] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Ürün Özel Not Popover
  const [editingItemNote, setEditingItemNote] = useState<{ id: string; name: string; note: string } | null>(null);

  // Başlangıç verilerini yükle
  useEffect(() => {
    async function init() {
      setLoading(true);
      const [restRes, usersRes] = await Promise.all([
        getRestaurants(),
        getUsers(),
      ]);

      if (restRes.success && restRes.data?.length) {
        setRestaurants(restRes.data);
        setSelectedRestaurantId(restRes.data[0].id);
      }

      if (usersRes.success && usersRes.data) {
        const waiterList = usersRes.data.filter((u: any) => u.role === "WAITER" || u.role === "ADMIN");
        setWaiters(waiterList);
        if (waiterList.length > 0) setSelectedWaiterId(waiterList[0].id);
      }

      setLoading(false);
    }
    init();
  }, []);

  // Restoran değiştikçe masaları ve menüyü güncelle
  useEffect(() => {
    if (!selectedRestaurantId) return;

    async function loadRestaurantData() {
      const [tablesRes, catsRes] = await Promise.all([
        getTables(selectedRestaurantId),
        getCategoriesTree(selectedRestaurantId),
      ]);

      if (tablesRes.success && tablesRes.data) {
        setTables(tablesRes.data);
        if (tablesRes.data.length > 0) {
          // Önceki seçili masa yeni restoranda yoksa ilk masayı seç
          const currentTableValid = tablesRes.data.some((t: any) => t.id === selectedTable?.id);
          if (!currentTableValid) {
            setSelectedTable(tablesRes.data[0]);
          }
        } else {
          setSelectedTable(null);
        }
      }

      if (catsRes.success && catsRes.data) {
        setCategoriesTree(catsRes.data);
        if (catsRes.data.length > 0) {
          setSelectedRootCatId(catsRes.data[0].id);
          if (catsRes.data[0].children?.length > 0) {
            setSelectedSubCatId(catsRes.data[0].children[0].id);
            if (catsRes.data[0].children[0].children?.length > 0) {
              setSelectedSubSubCatId(catsRes.data[0].children[0].children[0].id);
            } else {
              setSelectedSubSubCatId("");
            }
          } else {
            setSelectedSubCatId("");
            setSelectedSubSubCatId("");
          }
        }
      }
    }

    loadRestaurantData();
  }, [selectedRestaurantId]);

  // Seçili masanın açık siparişlerini getir
  useEffect(() => {
    if (!selectedTable) {
      setActiveTableOrders([]);
      return;
    }
    async function loadTableOrders() {
      const res = await getTableActiveOrders(selectedTable.id);
      if (res.success && res.data) {
        setActiveTableOrders(res.data);
      }
    }
    loadTableOrders();
  }, [selectedTable]);

  // Seçili Kök Kategori değiştiğinde
  const handleRootCatChange = (catId: string) => {
    setSelectedRootCatId(catId);
    const root = categoriesTree.find((c) => c.id === catId);
    if (root?.children?.length > 0) {
      setSelectedSubCatId(root.children[0].id);
      if (root.children[0].children?.length > 0) {
        setSelectedSubSubCatId(root.children[0].children[0].id);
      } else {
        setSelectedSubSubCatId("");
      }
    } else {
      setSelectedSubCatId("");
      setSelectedSubSubCatId("");
    }
  };

  // Seçili Alt Kategori değiştiğinde
  const handleSubCatChange = (catId: string) => {
    setSelectedSubCatId(catId);
    const root = categoriesTree.find((c) => c.id === selectedRootCatId);
    const sub = root?.children?.find((c: any) => c.id === catId);
    if (sub?.children?.length > 0) {
      setSelectedSubSubCatId(sub.children[0].id);
    } else {
      setSelectedSubSubCatId("");
    }
  };

  // Ekranda gösterilecek ürünleri hiyerarşiye ve aramaya göre belirle
  const currentRoot = categoriesTree.find((c) => c.id === selectedRootCatId);
  const currentSub = currentRoot?.children?.find((c: any) => c.id === selectedSubCatId);
  const currentSubSub = currentSub?.children?.find((c: any) => c.id === selectedSubSubCatId);

  // Gösterilecek ürünler
  let displayedItems: any[] = [];
  if (currentSubSub) {
    displayedItems = currentSubSub.items || [];
  } else if (currentSub) {
    displayedItems = currentSub.items || [];
  } else if (currentRoot) {
    displayedItems = currentRoot.items || [];
  }

  // Arama filtresi
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    // Ağacın tüm ürünlerinde ara
    const allItems: any[] = [];
    const collectItems = (cats: any[]) => {
      for (const cat of cats) {
        if (cat.items) allItems.push(...cat.items);
        if (cat.children) collectItems(cat.children);
      }
    };
    collectItems(categoriesTree);
    displayedItems = allItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
    );
  }

  // Sepet İşlemleri
  const addToCart = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.menuItemId === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.menuItemId === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          quantity: 1,
          itemNotes: "",
          categoryName: item.category?.name,
        },
      ];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.menuItemId === itemId);
      if (!existing) return prev;
      if (existing.quantity > 1) {
        return prev.map((ci) =>
          ci.menuItemId === itemId ? { ...ci, quantity: ci.quantity - 1 } : ci
        );
      }
      return prev.filter((ci) => ci.menuItemId !== itemId);
    });
  };

  const updateItemNote = (itemId: string, note: string) => {
    setCart((prev) =>
      prev.map((ci) => (ci.menuItemId === itemId ? { ...ci, itemNotes: note } : ci))
    );
    setEditingItemNote(null);
  };

  // Siparişi Mutfağa Gönder
  const handleSendOrder = async () => {
    if (!selectedTable || cart.length === 0 || !selectedWaiterId) return;

    setSubmitting(true);
    const res = await createOrder({
      restaurantId: selectedRestaurantId,
      tableId: selectedTable.id,
      waiterId: selectedWaiterId,
      notes: generalOrderNotes,
      items: cart.map((c) => ({
        menuItemId: c.menuItemId,
        quantity: c.quantity,
        itemNotes: c.itemNotes,
      })),
    });

    setSubmitting(false);

    if (res.success) {
      setSuccessMessage(
        `${selectedTable.name} için ${cart.reduce((a, b) => a + b.quantity, 0)} kalem sipariş mutfağa gönderildi!`
      );
      setCart([]);
      setGeneralOrderNotes("");
      setIsConfirmModalOpen(false);

      // Masanın siparişlerini tazele
      const ordersRes = await getTableActiveOrders(selectedTable.id);
      if (ordersRes.success && ordersRes.data) {
        setActiveTableOrders(ordersRes.data);
      }

      // Masalar listesini tazele
      const tablesRes = await getTables(selectedRestaurantId);
      if (tablesRes.success && tablesRes.data) {
        setTables(tablesRes.data);
      }

      setTimeout(() => setSuccessMessage(null), 4000);
    } else {
      alert("Sipariş gönderilirken hata oluştu: " + res.error);
    }
  };

  const totalCartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-zinc-400 text-sm">Alakart Menü ve Masalar Yükleniyor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full pb-28">
      {/* Top Header / Context Bar */}
      <div className="bg-[#0f1422] border-b border-zinc-800 p-3 sm:p-4 sticky top-14 z-40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Restaurant Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 uppercase tracking-wider hidden sm:inline">Alakart:</span>
            <select
              value={selectedRestaurantId}
              onChange={(e) => setSelectedRestaurantId(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 text-amber-300 text-xs sm:text-sm font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500"
            >
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Table Selector Button */}
          <button
            onClick={() => setIsTableModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-500/40 text-amber-300 hover:border-amber-400 text-xs sm:text-sm font-bold shadow-sm"
          >
            <span>MASA:</span>
            <span className="text-white text-sm sm:text-base font-extrabold underline decoration-amber-400">
              {selectedTable ? selectedTable.name : "Masa Seçin"}
            </span>
            {selectedTable?.status === "OCCUPIED" && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            )}
          </button>

          {/* Waiter Selector */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-300">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <select
              value={selectedWaiterId}
              onChange={(e) => setSelectedWaiterId(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs rounded-lg px-2 py-1 focus:outline-none"
            >
              {waiters.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.role === "ADMIN" ? "Yönetici" : "Garson"})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-3">
          <input
            type="text"
            placeholder="Yemek, içecek veya özellik ara (örn: Burrata, Steak, Çay)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/90 border border-zinc-700/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)}>
            <X className="w-4 h-4 text-emerald-400" />
          </button>
        </div>
      )}

      {/* Table Open Orders Alert (if occupied) */}
      {selectedTable && activeTableOrders.length > 0 && (
        <div className="mx-4 mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs flex items-center justify-between text-amber-300">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Bu masada mutfakta <strong>{activeTableOrders.length} aktif sipariş</strong> bulunuyor.</span>
          </div>
          <button
            onClick={() => setIsTableModalOpen(true)}
            className="text-[11px] underline text-amber-400 font-semibold"
          >
            İncele
          </button>
        </div>
      )}

      {/* Hiyerarşik Kategori Navigasyonu (Sadece arama boşken) */}
      {!searchQuery && (
        <div className="px-3 sm:px-4 py-3 space-y-2.5">
          {/* Seviye 1: Kök Kategoriler (Yiyecekler / İçecekler) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categoriesTree.map((root) => {
              const isSelected = root.id === selectedRootCatId;
              return (
                <button
                  key={root.id}
                  onClick={() => handleRootCatChange(root.id)}
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all shadow-sm",
                    isSelected
                      ? "bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 shadow-amber-500/20 scale-[1.02]"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
                  )}
                >
                  <Utensils className="w-4 h-4" />
                  <span>{root.name}</span>
                </button>
              );
            })}
          </div>

          {/* Seviye 2: Alt Kategoriler (Başlangıçlar, Ana Yemekler, Tatlılar...) */}
          {currentRoot?.children && currentRoot.children.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {currentRoot.children.map((sub: any) => {
                const isSelected = sub.id === selectedSubCatId;
                return (
                  <button
                    key={sub.id}
                    onClick={() => handleSubCatChange(sub.id)}
                    className={clsx(
                      "px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all",
                      isSelected
                        ? "bg-zinc-100 text-zinc-950 shadow-sm"
                        : "bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700"
                    )}
                  >
                    {sub.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Seviye 3: Alt-Alt Kategoriler (Soğuk Başlangıçlar, Sıcak Başlangıçlar...) */}
          {currentSub?.children && currentSub.children.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {currentSub.children.map((subsub: any) => {
                const isSelected = subsub.id === selectedSubSubCatId;
                return (
                  <button
                    key={subsub.id}
                    onClick={() => setSelectedSubSubCatId(subsub.id)}
                    className={clsx(
                      "px-3 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap border transition-all",
                      isSelected
                        ? "bg-amber-400/20 border-amber-400 text-amber-300"
                        : "border-zinc-800 text-zinc-400 hover:border-zinc-700"
                    )}
                  >
                    • {subsub.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Menü Öğeleri Listesi (Yemek / İçecek Kartları) */}
      <div className="px-3 sm:px-4 py-2">
        {displayedItems.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/60 text-zinc-500 text-xs sm:text-sm">
            Bu kategoride henüz tanımlı ürün bulunmuyor.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {displayedItems.map((item) => {
              const inCart = cart.find((ci) => ci.menuItemId === item.id);
              const qty = inCart ? inCart.quantity : 0;

              return (
                <div
                  key={item.id}
                  className={clsx(
                    "p-3.5 rounded-2xl border transition-all flex flex-col justify-between",
                    qty > 0
                      ? "bg-amber-500/10 border-amber-500/40 shadow-sm shadow-amber-500/5"
                      : "bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700"
                  )}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-sm font-bold text-white leading-snug">
                        {item.name}
                      </h4>
                      {/* Özel İstek / Pişme Notu Rozeti */}
                      {qty > 0 && (
                        <button
                          onClick={() =>
                            setEditingItemNote({
                              id: item.id,
                              name: item.name,
                              note: inCart?.itemNotes || "",
                            })
                          }
                          className={clsx(
                            "text-[10px] px-2 py-0.5 rounded font-medium border flex items-center gap-1",
                            inCart?.itemNotes
                              ? "bg-amber-400 text-zinc-950 border-amber-300 font-bold"
                              : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                          )}
                        >
                          {inCart?.itemNotes ? `Not: ${inCart.itemNotes}` : "+ Not"}
                        </button>
                      )}
                    </div>

                    {item.description && (
                      <p className="text-zinc-400 text-xs leading-relaxed line-clamp-2 mb-2">
                        {item.description}
                      </p>
                    )}

                    {item.allergens && (
                      <span className="inline-block text-[10px] text-amber-400/90 bg-amber-400/10 px-2 py-0.5 rounded mb-2">
                        ⚠️ Alerjen: {item.allergens}
                      </span>
                    )}
                  </div>

                  {/* Alt Kontrol: Ekle / Adet Stepper */}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                    <span className="text-[11px] text-zinc-500 font-medium">
                      5★ Lüks İkram
                    </span>

                    {qty === 0 ? (
                      <button
                        onClick={() => addToCart(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-transform active:scale-95 shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Siparişe Ekle</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 bg-zinc-950/80 border border-amber-500/40 rounded-xl p-1">
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-amber-400 font-extrabold text-sm w-5 text-center">
                          {qty}
                        </span>
                        <button
                          onClick={() => addToCart(item)}
                          className="w-7 h-7 rounded-lg bg-amber-500 hover:bg-amber-400 flex items-center justify-center text-zinc-950 font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Bottom Cart Bar */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-zinc-950/95 border-t border-amber-500/30 backdrop-blur-lg z-50">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-zinc-950 flex items-center justify-center font-extrabold text-sm shadow-md shadow-amber-500/30">
                {totalCartCount}
              </div>
              <div>
                <span className="text-xs text-zinc-400 block">
                  {selectedTable ? selectedTable.name : "Masa"} için Seçildi
                </span>
                <span className="text-sm font-bold text-white">
                  {cart.length} Farklı Çeşit Yemek / İçecek
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsConfirmModalOpen(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-zinc-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-500/25 active:scale-95 transition-all"
            >
              <Send className="w-4 h-4" />
              <span>Siparişi İncele & Mutfağa Gönder</span>
            </button>
          </div>
        </div>
      )}

      {/* Sipariş Onay & Gönderim Modalı */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1422] border border-amber-500/40 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl max-h-[90vh] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold block">
                    {restaurants.find((r) => r.id === selectedRestaurantId)?.name}
                  </span>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>Mutfak Sipariş Fişi</span>
                    <span className="px-2 py-0.5 rounded-lg bg-amber-400/20 text-amber-300 text-xs font-extrabold">
                      {selectedTable?.name}
                    </span>
                  </h3>
                </div>
                <button
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sipariş Kalemleri Listesi */}
              <div className="py-4 space-y-2.5 max-h-[40vh] overflow-y-auto pr-1">
                {cart.map((ci) => (
                  <div
                    key={ci.menuItemId}
                    className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-start justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2 font-bold text-white">
                        <span className="text-amber-400 font-extrabold text-sm">
                          {ci.quantity}x
                        </span>
                        <span>{ci.name}</span>
                      </div>
                      {ci.itemNotes && (
                        <div className="text-[11px] text-amber-300/90 mt-1 bg-amber-400/10 px-2 py-0.5 rounded inline-block font-medium">
                          Özel İstek: {ci.itemNotes}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => removeFromCart(ci.menuItemId)}
                        className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-zinc-300"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => addToCart({ id: ci.menuItemId, name: ci.name })}
                        className="w-6 h-6 rounded bg-amber-500 text-zinc-950 font-bold flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Masaya Özel Genel Not */}
              <div className="pt-2">
                <label className="text-xs text-zinc-400 block mb-1 font-medium">
                  Masaya / Mutfağa Özel Genel Not (İsteğe Bağlı):
                </label>
                <textarea
                  placeholder="Örn: VIP Misafir, Doğum günü pastası sonradan gelecek, Servis hızlı rica edildi..."
                  value={generalOrderNotes}
                  onChange={(e) => setGeneralOrderNotes(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  rows={2}
                />
              </div>
            </div>

            {/* Gönder Butonu */}
            <div className="pt-4 border-t border-zinc-800 mt-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white text-xs font-semibold"
              >
                Geri Dön
              </button>
              <button
                disabled={submitting}
                onClick={handleSendOrder}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-xs sm:text-sm shadow-md shadow-amber-500/20"
              >
                {submitting ? (
                  <span>Mutfağa İletiliyor...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>MUTFAĞA GÖNDER</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Masa Seçici & Masa Detay Modalı */}
      {isTableModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1422] border border-zinc-800 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl max-h-[85vh] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Masa Seçimi & Durum Takibi
                  </h3>
                  <span className="text-xs text-zinc-400">
                    {restaurants.find((r) => r.id === selectedRestaurantId)?.name}
                  </span>
                </div>
                <button
                  onClick={() => setIsTableModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Masalar Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto pr-1">
                {tables.map((t) => {
                  const isSelected = selectedTable?.id === t.id;
                  const isOccupied = t.status === "OCCUPIED" || t.orders?.length > 0;

                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedTable(t);
                        setIsTableModalOpen(false);
                      }}
                      className={clsx(
                        "p-3 rounded-2xl border text-left transition-all",
                        isSelected
                          ? "ring-2 ring-amber-400 bg-amber-500/20 border-amber-500"
                          : isOccupied
                          ? "bg-amber-950/20 border-amber-500/30 hover:border-amber-400/60"
                          : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs sm:text-sm font-bold text-white">
                          {t.name}
                        </span>
                        <span
                          className={clsx(
                            "w-2.5 h-2.5 rounded-full",
                            isOccupied ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
                          )}
                        />
                      </div>
                      <span className="text-[11px] text-zinc-400 block">
                        Kapasite: {t.capacity} Kişi
                      </span>
                      <span
                        className={clsx(
                          "text-[10px] font-bold mt-1 inline-block px-1.5 py-0.2 rounded",
                          isOccupied
                            ? "bg-amber-400/10 text-amber-300"
                            : "bg-emerald-400/10 text-emerald-300"
                        )}
                      >
                        {isOccupied ? "Sipariş Açık" : "Masa Boş"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800 mt-4 flex items-center justify-between text-xs text-zinc-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                  Boş Masa
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  Siparişte / Dolu
                </span>
              </div>
              <button
                onClick={() => setIsTableModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ürün Özel Not Düzenleme Popover */}
      {editingItemNote && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1422] border border-amber-500/40 rounded-3xl max-w-sm w-full p-5 shadow-2xl">
            <h4 className="text-sm font-bold text-white mb-1">
              Özel Pişirme & Servis Notu
            </h4>
            <span className="text-xs text-amber-400 block mb-3">
              {editingItemNote.name}
            </span>

            {/* Hızlı Seçim Butonları */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {["Az Pişmiş", "Orta Pişmiş", "İyi Pişmiş", "Buzsuz", "Glutensiz", "Sossuz", "Sosu Ayrı"].map(
                (quickNote) => (
                  <button
                    key={quickNote}
                    onClick={() =>
                      setEditingItemNote({ ...editingItemNote, note: quickNote })
                    }
                    className="text-[10px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
                  >
                    {quickNote}
                  </button>
                )
              )}
            </div>

            <input
              type="text"
              placeholder="Veya özel not yazın..."
              value={editingItemNote.note}
              onChange={(e) =>
                setEditingItemNote({ ...editingItemNote, note: e.target.value })
              }
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 mb-4"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingItemNote(null)}
                className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-xs"
              >
                İptal
              </button>
              <button
                onClick={() => updateItemNote(editingItemNote.id, editingItemNote.note)}
                className="px-4 py-1.5 rounded-lg bg-amber-500 text-zinc-950 font-bold text-xs"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
