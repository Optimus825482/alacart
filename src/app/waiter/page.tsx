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
import { getTables, getCategoriesTree, getRestaurants } from "@/actions/definitions";
import { createOrder, getTableActiveOrders } from "@/actions/orders";
import { getSessionUser, selectRestaurantAction, logoutAction, clearActiveRestaurantAction, SessionUser } from "@/actions/auth";
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
  const [availableRestaurants, setAvailableRestaurants] = useState<any[]>([]);
  const [currentRestaurant, setCurrentRestaurant] = useState<any | null>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [tableStatusFilter, setTableStatusFilter] = useState<"ALL" | "EMPTY" | "OCCUPIED">("ALL");

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
      try {
        const [user, restsRes] = await Promise.all([
          getSessionUser(),
          getRestaurants(),
        ]);

        if (restsRes?.success && restsRes.data) {
          setAvailableRestaurants(restsRes.data);
        }

        if (!user) {
          router.push("/login");
          return;
        }
        setSession(user);

        if (user.activeRestaurantId) {
          await loadRestaurant(user.activeRestaurantId);
        }
      } catch (err) {
        console.error("Waiter init error:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const loadRestaurant = async (restId: string) => {
    try {
      // Masaları ve Kategorileri yükle
      const [tablesRes, catsRes] = await Promise.all([
        getTables(restId),
        getCategoriesTree(restId),
      ]);

      if (tablesRes.success && tablesRes.data) {
        setTables(tablesRes.data);
        // Otomatik masa seçimi kaldırıldı; kullanıcı önce masa listesi ekranını görür.
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
    } catch (err) {
      console.error("loadRestaurant error:", err);
    }
  };

  // Restoran Seçimi Yapıldığında (Kilitleme)
  const handleSelectRestaurant = async (restaurantIdOrCode: string) => {
    setLoading(true);
    try {
      const res = await selectRestaurantAction(restaurantIdOrCode);
      if (res.success && res.restaurant) {
        setCurrentRestaurant(res.restaurant);
        setSession((prev) => ({
          ...(prev || {
            id: "waiter",
            name: "Garson",
            username: "garson",
            role: "WAITER",
          }),
          activeRestaurantId: res.restaurant.id,
          activeRestaurantName: res.restaurant.name,
        }));
        await loadRestaurant(res.restaurant.id);
      } else {
        alert("Restoran seçilemedi: " + (res.error || "Bilinmeyen hata"));
      }
    } catch (err: any) {
      console.error("handleSelectRestaurant error:", err);
      alert("Hata oluştu: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Restoran Değiştirme
  const handleSwitchRestaurant = async () => {
    setLoading(true);
    try {
      await clearActiveRestaurantAction();
      setSession((prev) => prev ? { ...prev, activeRestaurantId: null, activeRestaurantName: null } : null);
      setCurrentRestaurant(null);
      setCart([]);
      setSelectedTable(null);
      setTables([]);
      setCategoriesTree([]);
    } catch (err) {
      console.error("handleSwitchRestaurant error:", err);
    } finally {
      setLoading(false);
    }
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

      if (session.activeRestaurantId) {
        const tablesRes = await getTables(session.activeRestaurantId);
        if (tablesRes.success && tablesRes.data) setTables(tablesRes.data);
      }

      // Sipariş gönderildikten sonra garson yeni masa seçimi için doğrudan masa listesine döner
      setTimeout(() => {
        setSelectedTable(null);
      }, 1500);

      setTimeout(() => setSuccessMessage(null), 5000);
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
          {(availableRestaurants.length > 0
            ? availableRestaurants.map((r) => ({
                id: r.id,
                code: r.code,
                name: r.name,
                description: r.description,
                theme: getRestaurantTheme(r.code || r.name),
              }))
            : Object.values(RESTAURANT_THEMES).map((t) => ({
                id: t.code,
                code: t.code,
                name: t.name,
                description: t.subtitle,
                theme: t,
              }))
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelectRestaurant(item.id)}
              className={clsx(
                "p-5 rounded-3xl border text-left transition-all active:scale-[0.98] group flex flex-col justify-between",
                item.theme.bgDark,
                item.theme.border,
                item.theme.glow,
                "hover:ring-2 hover:ring-amber-400/50"
              )}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl">{item.theme.iconEmoji}</span>
                  <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full border", item.theme.badge)}>
                    {item.code}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white group-hover:text-amber-300 transition-colors">
                  {item.name}
                </h3>
                <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                  {item.description || item.theme.subtitle}
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
  // DURUM 2: RESTORAN SEÇİLDİ, ŞİMDİ MASA SEÇİMİ (MASA LİSTESİ EKRANI)
  // ===========================================================================
  if (!selectedTable) {
    const emptyCount = tables.filter((t) => t.status === "EMPTY" && (!t.orders || t.orders.length === 0)).length;
    const occupiedCount = tables.length - emptyCount;

    const filteredTables = tables.filter((t) => {
      const matchesSearch = t.name.toLowerCase().includes(tableSearchQuery.toLowerCase());
      const isOccupied = t.status === "OCCUPIED" || (t.orders && t.orders.length > 0);
      if (tableStatusFilter === "EMPTY") return matchesSearch && !isOccupied;
      if (tableStatusFilter === "OCCUPIED") return matchesSearch && isOccupied;
      return matchesSearch;
    });

    return (
      <div className={clsx("flex-1 flex flex-col max-w-5xl mx-auto w-full p-4 sm:p-6 pb-20", currentTheme.bgDark)}>
        {/* Üst Bar: Seçilen Alakart Sabit Bilgisi ve Garson Kontrolleri */}
        <div className={clsx("sticky top-14 z-40 flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 rounded-3xl border mb-6 backdrop-blur-md shadow-xl", currentTheme.cardBg, currentTheme.border)}>
          <div className="flex items-center gap-3">
            <span className="text-3xl sm:text-4xl">{currentTheme.iconEmoji}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className={clsx("text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border", currentTheme.badge)}>
                  SEÇİLEN ALAKART
                </span>
                <span className="text-[11px] text-zinc-400">Garson: <strong className="text-white">{session?.name}</strong></span>
              </div>
              <h2 className="text-base sm:text-xl font-black text-white mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="text-zinc-400 text-xs sm:text-sm font-bold">Seçilen Alakart:</span>
                <span className={clsx("text-base sm:text-xl font-extrabold", currentTheme.textAccent)}>
                  {session?.activeRestaurantName || currentTheme.name}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSwitchRestaurant}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-zinc-900 border border-zinc-700/80 hover:border-zinc-500 text-zinc-300 hover:text-white text-xs font-bold transition-all shadow-sm"
            >
              <Utensils className="w-3.5 h-3.5 text-amber-400" />
              <span>Restoran Değiştir</span>
            </button>
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-bold hover:bg-rose-900/60 transition-all shadow-sm"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Çıkış</span>
              </button>
            </form>
          </div>
        </div>

        {/* Başarı Bildirimi (Örn: Sipariş mutfağa iletildikten sonra masa listesine dönüldüğünde) */}
        {successMessage && (
          <div className="mb-6 p-4 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm flex items-center justify-between animate-in fade-in shadow-lg">
            <div className="flex items-center gap-2.5">
              <Check className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="font-bold text-white">{successMessage}</span>
                <p className="text-[11px] text-emerald-300/80">Yeni bir masa seçerek sonraki siparişe geçebilirsiniz.</p>
              </div>
            </div>
            <button onClick={() => setSuccessMessage(null)}>
              <X className="w-4 h-4 text-emerald-400" />
            </button>
          </div>
        )}

        {/* Başlık ve Sayaçlar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-xs uppercase tracking-widest text-amber-400 font-bold block mb-1">
              ADIM 2: MASA SEÇİMİ
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Sipariş Alınacak Masayı Seçin
            </h1>
            <p className="text-zinc-400 text-xs sm:text-sm mt-1">
              Sipariş girişi yapmak için lütfen aşağıdaki masalardan birine dokunun. Seçilen masanın alakart menüsü açılacaktır.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-medium">
              Toplam: <strong className="text-white font-bold">{tables.length}</strong> Masa
            </span>
            <span className="px-3 py-1.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 font-medium">
              Boş: <strong className="text-emerald-200 font-bold">{emptyCount}</strong>
            </span>
            <span className="px-3 py-1.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 font-medium">
              Dolu: <strong className="text-rose-200 font-bold">{occupiedCount}</strong>
            </span>
          </div>
        </div>

        {/* Arama ve Filtre Butonları */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Masa numarası veya adı ile ara (örn: Masa 1, Teras, VIP)..."
              value={tableSearchQuery}
              onChange={(e) => setTableSearchQuery(e.target.value)}
              className="w-full bg-zinc-950/90 border border-zinc-800 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
            {tableSearchQuery && (
              <button
                onClick={() => setTableSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-zinc-950/80 p-1 rounded-2xl border border-zinc-800">
            <button
              onClick={() => setTableStatusFilter("ALL")}
              className={clsx(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                tableStatusFilter === "ALL" ? "bg-amber-500 text-zinc-950 shadow" : "text-zinc-400 hover:text-white"
              )}
            >
              Tümü ({tables.length})
            </button>
            <button
              onClick={() => setTableStatusFilter("EMPTY")}
              className={clsx(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                tableStatusFilter === "EMPTY" ? "bg-emerald-500 text-zinc-950 shadow" : "text-emerald-400 hover:text-emerald-300"
              )}
            >
              Boş ({emptyCount})
            </button>
            <button
              onClick={() => setTableStatusFilter("OCCUPIED")}
              className={clsx(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                tableStatusFilter === "OCCUPIED" ? "bg-rose-500 text-white shadow" : "text-rose-400 hover:text-rose-300"
              )}
            >
              Dolu ({occupiedCount})
            </button>
          </div>
        </div>

        {/* Masalar Grid'i */}
        {filteredTables.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-zinc-900/30 border border-zinc-800">
            <Armchair className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm font-medium">
              Arama kriterlerine uygun masa bulunamadı.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 sm:gap-4">
            {filteredTables.map((t) => {
              const isOccupied = t.status === "OCCUPIED" || (t.orders && t.orders.length > 0);
              const orderCount = t.orders?.length || 0;

              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTable(t);
                    setCart([]);
                    setGeneralOrderNotes("");
                  }}
                  className={clsx(
                    "p-4 sm:p-5 rounded-3xl border text-left transition-all active:scale-[0.97] flex flex-col justify-between group relative overflow-hidden shadow-lg",
                    isOccupied
                      ? "bg-rose-950/20 border-rose-500/40 hover:border-rose-400 hover:bg-rose-950/30"
                      : "bg-zinc-900/70 border-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-950/20",
                    "hover:shadow-xl"
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className={clsx(
                        "w-10 h-10 rounded-2xl flex items-center justify-center font-bold",
                        isOccupied ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"
                      )}>
                        <Armchair className="w-5 h-5" />
                      </div>
                      <span className={clsx(
                        "text-[10px] font-black uppercase px-2 py-0.5 rounded-full border",
                        isOccupied
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      )}>
                        {isOccupied ? "DOLU" : "BOŞ"}
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-black text-white group-hover:text-amber-300 transition-colors">
                      {t.name}
                    </h3>
                    <p className="text-zinc-400 text-xs mt-1 flex items-center gap-1.5">
                      <span>👥 {t.capacity || 4} Kişilik</span>
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                    {isOccupied ? (
                      <span className="text-rose-400 font-bold text-[11px]">
                        {orderCount > 0 ? `${orderCount} Açık Sipariş` : "Dolu Masa"}
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-bold text-[11px]">
                        Müsait
                      </span>
                    )}
                    <span className="text-amber-400 font-black group-hover:translate-x-1 transition-transform">
                      Menüyü Aç ➔
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ===========================================================================
  // DURUM 3: MASA SEÇİLDİ VE GARSON SİPARİŞ EKRANI
  // ===========================================================================
  return (
    <div className={clsx("flex-1 flex flex-col max-w-5xl mx-auto w-full pb-28", currentTheme.bgDark)}>
      {/* Sabit Alakart Başlığı (Karışıklığı Önleyen Özel Renkli Header) */}
      <div className={clsx("sticky top-14 z-40 border-b p-3 sm:p-4 backdrop-blur-md", currentTheme.border, currentTheme.bgDark)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Sabit Restoran Rozeti */}
          <div className="flex items-center gap-2.5">
            <span className="text-2xl sm:text-3xl">{currentTheme.iconEmoji}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className={clsx("text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border", currentTheme.badge)}>
                  SEÇİLEN ALAKART
                </span>
              </div>
              <h2 className="text-sm sm:text-lg font-black text-white leading-tight flex flex-wrap items-center gap-1.5">
                <span className="text-zinc-400 text-xs sm:text-sm font-bold">Seçilen Alakart:</span>
                <span className={clsx("font-extrabold", currentTheme.textAccent)}>
                  {session?.activeRestaurantName || currentTheme.name}
                </span>
              </h2>
            </div>
          </div>

          {/* Seçili Masa ve Masalara Dön Butonu */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedTable(null);
                setCart([]);
              }}
              title="Masa Listesine Geri Dön"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs sm:text-sm font-bold shadow-md active:scale-95 transition-all"
            >
              <span>← Masalar</span>
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-zinc-950/80 border border-zinc-700 text-xs sm:text-sm font-bold shadow-md">
              <Armchair className="w-4 h-4 text-amber-400" />
              <span className="text-zinc-400">MASA:</span>
              <span className="text-white text-sm sm:text-base font-extrabold underline decoration-amber-400">
                {selectedTable.name}
              </span>
              {selectedTable?.status === "OCCUPIED" && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              )}
            </div>
          </div>

          {/* Garson Kimliği & Güvenli Çıkış */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-300 hidden sm:inline">
              Garson: <strong>{session?.name}</strong>
            </span>
            <button
              type="button"
              onClick={handleSwitchRestaurant}
              title="Farklı Bir Alakarta Geçiş Yap"
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs font-bold hover:bg-amber-900/60 transition-all"
            >
              <Utensils className="w-3.5 h-3.5" />
              <span className="text-[11px]">Değiştir</span>
            </button>
            <form action={logoutAction}>
              <button
                type="submit"
                title="Çıkış Yap"
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
