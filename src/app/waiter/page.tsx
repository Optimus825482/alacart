"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Utensils,
  Check,
  Plus,
  Minus,
  Send,
  Clock,
  Sparkles,
  ShoppingBag,
  X,
  UserCheck,
  Armchair,
  LogOut,
  Image as ImageIcon,
} from "lucide-react";
import { getTables, getCategoriesTree } from "@/actions/definitions";
import { createOrder, getTableActiveOrders } from "@/actions/orders";
import { getSessionUser, selectRestaurantAction, logoutAction, SessionUser } from "@/actions/auth";
import { getRestaurantTheme, RESTAURANT_THEMES } from "@/lib/themes";
import clsx from "clsx";

interface CartItem {
  menuItemId: string;
  name: string;
  quantity: number;
  itemNotes: string;
  imageUrl?: string | null;
}

export default function WaiterTerminalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionUser | null>(null);

  // Restoran & Masa Bilgileri
  const [currentRestaurant, setCurrentRestaurant] = useState<any | null>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<any | null>(null);

  // Hiyerarşik Kategori Navigasyonu
  const [categoriesTree, setCategoriesTree] = useState<any[]>([]);
  const [selectedRootCatId, setSelectedRootCatId] = useState<string>("");
  const [selectedSubCatId, setSelectedSubCatId] = useState<string>("");
  const [selectedSubSubCatId, setSelectedSubSubCatId] = useState<string>("");

  // Arama & Sepet
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [generalOrderNotes, setGeneralOrderNotes] = useState("");
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [activeTableOrders, setActiveTableOrders] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Özel Not Modal State
  const [editingItemNote, setEditingItemNote] = useState<{ id: string; name: string; note: string } | null>(null);

  // Oturum ve Restoran Doğrulaması
  useEffect(() => {
    async function init() {
      setLoading(true);
      const user = await getSessionUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setSession(user);

      if (user.activeRestaurantId) {
        await loadRestaurant(user.activeRestaurantId);
      }
      setLoading(false);
    }
    init();
  }, []);

  const loadRestaurant = async (restId: string) => {
    // Masaları ve Kategorileri yükle
    const [tablesRes, catsRes] = await Promise.all([
      getTables(restId),
      getCategoriesTree(restId),
    ]);

    if (tablesRes.success && tablesRes.data) {
      setTables(tablesRes.data);
      if (tablesRes.data.length > 0) {
        setSelectedTable(tablesRes.data[0]);
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
          }
        }
      }
    }
  };

  // Restoran Seçimi Yapıldığında (Kilitleme)
  const handleSelectRestaurant = async (restaurantId: string) => {
    setLoading(true);
    const res = await selectRestaurantAction(restaurantId);
    if (res.success && res.restaurant) {
      setCurrentRestaurant(res.restaurant);
      setSession((prev) => prev ? { ...prev, activeRestaurantId: res.restaurant.id, activeRestaurantName: res.restaurant.name } : null);
      await loadRestaurant(res.restaurant.id);
    }
    setLoading(false);
  };

  // Masanın açık siparişleri
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

  // Kategori Navigasyonu
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

  // Menü Öğelerini Belirleme
  const currentRoot = categoriesTree.find((c) => c.id === selectedRootCatId);
  const currentSub = currentRoot?.children?.find((c: any) => c.id === selectedSubCatId);
  const currentSubSub = currentSub?.children?.find((c: any) => c.id === selectedSubSubCatId);

  let displayedItems: any[] = [];
  if (currentSubSub) displayedItems = currentSubSub.items || [];
  else if (currentSub) displayedItems = currentSub.items || [];
  else if (currentRoot) displayedItems = currentRoot.items || [];

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    const allItems: any[] = [];
    const collect = (cats: any[]) => {
      for (const cat of cats) {
        if (cat.items) allItems.push(...cat.items);
        if (cat.children) collect(cat.children);
      }
    };
    collect(categoriesTree);
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
          imageUrl: item.imageUrl,
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

  // Mutfağa Gönder
  const handleSendOrder = async () => {
    if (!selectedTable || cart.length === 0 || !session?.id || !session.activeRestaurantId) return;

    setSubmitting(true);
    const res = await createOrder({
      restaurantId: session.activeRestaurantId,
      tableId: selectedTable.id,
      waiterId: session.id,
      notes: generalOrderNotes,
      items: cart.map((c) => ({
        menuItemId: c.menuItemId,
        quantity: c.quantity,
        itemNotes: c.itemNotes,
      })),
    });

    setSubmitting(false);

    if (res.success) {
      setSuccessMessage(`${selectedTable.name} siparişi başarıyla mutfağa iletildi!`);
      setCart([]);
      setGeneralOrderNotes("");
      setIsConfirmModalOpen(false);

      const [ordersRes, tablesRes] = await Promise.all([
        getTableActiveOrders(selectedTable.id),
        getTables(session.activeRestaurantId),
      ]);
      if (ordersRes.success && ordersRes.data) setActiveTableOrders(ordersRes.data);
      if (tablesRes.success && tablesRes.data) setTables(tablesRes.data);

      setTimeout(() => setSuccessMessage(null), 4000);
    } else {
      alert("Hata: " + res.error);
    }
  };

  // Aktif Restoran Teması
  const currentTheme = getRestaurantTheme(session?.activeRestaurantName);
  const totalCartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-[#070a12]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-zinc-400 text-xs">Oturum ve Alakart Yükleniyor...</span>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // DURUM 1: GARSON HENÜZ ALAKART RESTORAN SEÇMEDİYSE (RESTORAN SEÇİM EKRANI)
  // ===========================================================================
  if (!session?.activeRestaurantId) {
    return (
      <div className="flex-1 flex flex-col p-4 sm:p-8 max-w-4xl mx-auto w-full justify-center">
        <div className="text-center mb-8">
          <span className="text-xs uppercase tracking-widest text-amber-400 font-bold block mb-1">
            GÖREV YERİ SEÇİMİ
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Sayın {session?.name}, Hangi Alakartta Görevlisiniz?
          </h2>
          <p className="text-zinc-400 text-xs sm:text-sm mt-1">
            Görevli olduğunuz alakartı seçin. Seçiminiz kilitlenecek ve karışıklığı önlemek için özel renk teması uygulanacaktır.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.values(RESTAURANT_THEMES).map((theme) => (
            <button
              key={theme.code}
              onClick={() => handleSelectRestaurant(theme.code)}
              className={clsx(
                "p-5 rounded-3xl border text-left transition-all active:scale-[0.98] group flex flex-col justify-between",
                theme.bgDark,
                theme.border,
                theme.glow,
                "hover:ring-2 hover:ring-amber-400/50"
              )}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl">{theme.iconEmoji}</span>
                  <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full border", theme.badge)}>
                    {theme.code}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white group-hover:text-amber-300 transition-colors">
                  {theme.name}
                </h3>
                <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                  {theme.subtitle}
                </p>
              </div>

              <div className="pt-4 border-t border-zinc-800/80 mt-4 flex items-center justify-between text-xs font-bold text-amber-400">
                <span>Giriş Yap & Kilitle</span>
                <span>➔</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ===========================================================================
  // DURUM 2: RESTORAN KİLİTLİ VE GARSON SİPARİŞ EKRANI
  // ===========================================================================
  return (
    <div className={clsx("flex-1 flex flex-col max-w-5xl mx-auto w-full pb-28", currentTheme.bgDark)}>
      {/* Sabit Alakart Başlığı (Karışıklığı Önleyen Özel Renkli Header) */}
      <div className={clsx("sticky top-14 z-40 border-b p-3 sm:p-4 backdrop-blur-md", currentTheme.border, currentTheme.bgDark)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Sabit Restoran Rozeti */}
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{currentTheme.iconEmoji}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className={clsx("text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border", currentTheme.badge)}>
                  SABİTLENMİŞ ALAKART
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white leading-tight">
                {session?.activeRestaurantName || currentTheme.name}
              </h2>
            </div>
          </div>

          {/* Masa Seçici Butonu */}
          <button
            onClick={() => setIsTableModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-zinc-950/80 border border-amber-500/40 text-amber-300 hover:border-amber-400 text-xs sm:text-sm font-bold shadow-md active:scale-95 transition-all"
          >
            <Armchair className="w-4 h-4 text-amber-400" />
            <span>MASA:</span>
            <span className="text-white text-sm sm:text-base font-extrabold underline decoration-amber-400">
              {selectedTable ? selectedTable.name : "Masa Seçin"}
            </span>
            {selectedTable?.status === "OCCUPIED" && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            )}
          </button>

          {/* Garson Kimliği & Güvenli Çıkış */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-300 hidden sm:inline">
              Garson: <strong>{session?.name}</strong>
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                title="Restoran Değiştir / Çıkış Yap"
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-bold hover:bg-rose-900/60 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="text-[11px]">Çıkış</span>
              </button>
            </form>
          </div>
        </div>

        {/* Arama Barı */}
        <div className="mt-3">
          <input
            type="text"
            placeholder="Yemek, içecek veya özellik ara (örn: Wagyu, Burrata, Çay)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950/90 border border-zinc-700/80 rounded-2xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Başarı Bildirimi */}
      {successMessage && (
        <div className="mx-4 mt-3 p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Masada Açık Sipariş Uyarısı */}
      {selectedTable && activeTableOrders.length > 0 && (
        <div className="mx-4 mt-3 p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs flex items-center justify-between text-amber-300">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Bu masanın mutfakta <strong>{activeTableOrders.length} aktif siparişi</strong> var.</span>
          </div>
          <button
            onClick={() => setIsTableModalOpen(true)}
            className="text-[11px] underline font-bold"
          >
            Siparişleri İncele
          </button>
        </div>
      )}

      {/* Hiyerarşik Kategori Navigasyonu */}
      {!searchQuery && (
        <div className="px-3 sm:px-4 py-3 space-y-2.5">
          {/* Seviye 1: Kök Kategoriler */}
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
                      ? "bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 scale-[1.02]"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
                  )}
                >
                  <Utensils className="w-4 h-4" />
                  <span>{root.name}</span>
                </button>
              );
            })}
          </div>

          {/* Seviye 2: Alt Kategoriler */}
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

          {/* Seviye 3: Alt-Alt Kategoriler */}
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
                        : "border-zinc-800 text-zinc-400"
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

      {/* Menü Öğeleri Listesi (Yemek / İçecek Kartları - Görsel Destekli) */}
      <div className="px-3 sm:px-4 py-2">
        {displayedItems.length === 0 ? (
          <div className="p-8 text-center rounded-3xl bg-zinc-900/40 border border-zinc-800 text-zinc-500 text-xs">
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
                    "p-3.5 rounded-3xl border transition-all flex gap-3",
                    currentTheme.cardBg,
                    qty > 0
                      ? "border-amber-500 shadow-md shadow-amber-500/10"
                      : "border-zinc-800/80 hover:border-zinc-700"
                  )}
                >
                  {/* Ürün Görseli (Varsa) */}
                  {item.imageUrl && (
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shrink-0 bg-zinc-950 border border-zinc-800">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                  )}

                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <h4 className="text-xs sm:text-sm font-bold text-white leading-snug">
                          {item.name}
                        </h4>
                        {/* Not Butonu */}
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
                              "text-[10px] px-2 py-0.5 rounded-lg font-bold border shrink-0",
                              inCart?.itemNotes
                                ? "bg-amber-400 text-zinc-950 border-amber-300"
                                : "bg-zinc-800 text-zinc-300 border-zinc-700"
                            )}
                          >
                            {inCart?.itemNotes ? `Not: ${inCart.itemNotes}` : "+ Not"}
                          </button>
                        )}
                      </div>

                      {item.description && (
                        <p className="text-zinc-400 text-[11px] leading-relaxed line-clamp-2 mb-1.5">
                          {item.description}
                        </p>
                      )}

                      {item.allergens && (
                        <span className="text-[10px] text-amber-400/90 bg-amber-400/10 px-2 py-0.5 rounded-md inline-block">
                          ⚠️ {item.allergens}
                        </span>
                      )}
                    </div>

                    {/* Alt Kontrol: Ekle / Stepper */}
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 mt-2">
                      <span className="text-[10px] text-zinc-500 font-medium">
                        Ultra All-Inclusive
                      </span>

                      {qty === 0 ? (
                        <button
                          onClick={() => addToCart(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all active:scale-95 shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Ekle</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 bg-zinc-950/80 border border-amber-500/40 rounded-xl p-1">
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-amber-400 font-black text-xs w-4 text-center">
                            {qty}
                          </span>
                          <button
                            onClick={() => addToCart(item)}
                            className="w-6 h-6 rounded-lg bg-amber-500 hover:bg-amber-400 flex items-center justify-center text-zinc-950 font-bold"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Yüzen Sepet Barı */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-zinc-950/95 border-t border-amber-500/30 backdrop-blur-lg z-50">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-zinc-950 flex items-center justify-center font-extrabold text-sm shadow-md">
                {totalCartCount}
              </div>
              <div>
                <span className="text-xs text-zinc-400 block">
                  {selectedTable ? selectedTable.name : "Masa"} için Seçildi
                </span>
                <span className="text-sm font-bold text-white">
                  {cart.length} Çeşit Sipariş Kalemi
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsConfirmModalOpen(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-zinc-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/25 active:scale-95 transition-all"
            >
              <Send className="w-4 h-4" />
              <span>Siparişi İncele & Mutfağa Gönder</span>
            </button>
          </div>
        </div>
      )}

      {/* Sipariş Onay Modalı */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1422] border border-amber-500/40 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl max-h-[90vh] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold block">
                    {session?.activeRestaurantName}
                  </span>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <span>Mutfak Siparişi Onayı</span>
                    <span className="px-2 py-0.5 rounded-lg bg-amber-400/20 text-amber-300 text-xs font-bold">
                      {selectedTable?.name}
                    </span>
                  </h3>
                </div>
                <button
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-4 space-y-2.5 max-h-[40vh] overflow-y-auto pr-1">
                {cart.map((ci) => (
                  <div
                    key={ci.menuItemId}
                    className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2 font-bold text-white">
                        <span className="text-amber-400 font-black">{ci.quantity}x</span>
                        <span>{ci.name}</span>
                      </div>
                      {ci.itemNotes && (
                        <div className="text-[10px] text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded mt-1 inline-block">
                          Özel: {ci.itemNotes}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => removeFromCart(ci.menuItemId)} className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-zinc-300">-</button>
                      <button onClick={() => addToCart({ id: ci.menuItemId, name: ci.name })} className="w-6 h-6 rounded bg-amber-500 text-zinc-950 font-bold flex items-center justify-center">+</button>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1 font-bold">
                  Masaya / Mutfağa Özel Not:
                </label>
                <textarea
                  placeholder="Örn: VIP Misafir, pasta sonradan servis edilecek..."
                  value={generalOrderNotes}
                  onChange={(e) => setGeneralOrderNotes(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  rows={2}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800 mt-4 flex items-center justify-end gap-3">
              <button onClick={() => setIsConfirmModalOpen(false)} className="px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-xs">
                Geri Dön
              </button>
              <button
                disabled={submitting}
                onClick={handleSendOrder}
                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs sm:text-sm shadow-md"
              >
                {submitting ? "Gönderiliyor..." : "MUTFAĞA GÖNDER"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Masa Seçici Modalı */}
      {isTableModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1422] border border-zinc-800 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl max-h-[85vh] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
                <div>
                  <h3 className="text-base font-bold text-white">Masa Seçimi</h3>
                  <span className="text-xs text-amber-400 font-bold">
                    {session?.activeRestaurantName}
                  </span>
                </div>
                <button onClick={() => setIsTableModalOpen(false)} className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

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
                          ? "bg-amber-950/20 border-amber-500/30"
                          : "bg-zinc-900 border-zinc-800"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs sm:text-sm font-bold text-white">{t.name}</span>
                        <span className={clsx("w-2.5 h-2.5 rounded-full", isOccupied ? "bg-amber-400 animate-pulse" : "bg-emerald-400")} />
                      </div>
                      <span className="text-[11px] text-zinc-400 block">{t.capacity} Kişilik</span>
                      <span className={clsx("text-[10px] font-bold mt-1 inline-block px-1.5 py-0.2 rounded", isOccupied ? "bg-amber-400/10 text-amber-300" : "bg-emerald-400/10 text-emerald-300")}>
                        {isOccupied ? "Sipariş Açık" : "Masa Boş"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800 mt-4 text-right">
              <button onClick={() => setIsTableModalOpen(false)} className="px-4 py-2 rounded-xl bg-zinc-800 text-white font-semibold text-xs">
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Özel Not Popover */}
      {editingItemNote && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1422] border border-amber-500/40 rounded-3xl max-w-sm w-full p-5 shadow-2xl">
            <h4 className="text-sm font-bold text-white mb-1">Özel Pişirme & Servis Notu</h4>
            <span className="text-xs text-amber-400 block mb-3">{editingItemNote.name}</span>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {["Az Pişmiş", "Orta Pişmiş", "İyi Pişmiş", "Buzsuz", "Glutensiz", "Sossuz", "Sosu Ayrı", "Limonlu"].map(
                (quick) => (
                  <button
                    key={quick}
                    onClick={() => setEditingItemNote({ ...editingItemNote, note: quick })}
                    className="text-[10px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
                  >
                    {quick}
                  </button>
                )
              )}
            </div>

            <input
              type="text"
              placeholder="Özel istek girin..."
              value={editingItemNote.note}
              onChange={(e) => setEditingItemNote({ ...editingItemNote, note: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 mb-4"
            />

            <div className="flex items-center justify-end gap-2 text-xs">
              <button onClick={() => setEditingItemNote(null)} className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400">İptal</button>
              <button onClick={() => updateItemNote(editingItemNote.id, editingItemNote.note)} className="px-4 py-1.5 rounded-lg bg-amber-500 text-zinc-950 font-bold">Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
