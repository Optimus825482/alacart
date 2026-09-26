"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChefHat,
  Printer,
  CheckCircle2,
  Clock,
  Volume2,
  VolumeX,
  Flame,
  Check,
  Filter,
  LogOut,
  RefreshCw,
  Utensils,
  X,
  Eye,
} from "lucide-react";
import { getSessionUser, logoutAction, selectRestaurantAction, clearActiveRestaurantAction, SessionUser } from "@/actions/auth";
import { getRestaurants } from "@/actions/definitions";
import { playKitchenChime } from "@/lib/sound";
import { getRestaurantTheme, RESTAURANT_THEMES } from "@/lib/themes";
import clsx from "clsx";

export default function KitchenKDSPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [availableRestaurants, setAvailableRestaurants] = useState<any[]>([]);

  const [orders, setOrders] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ACTIVE");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const [printingOrder, setPrintingOrder] = useState<any | null>(null);
  const [previewOrder, setPreviewOrder] = useState<any | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Her siparişin ID'sini, son revizyon numarasını ve düzenleme zamanını takip eden ref
  const previousOrdersMapRef = useRef<Map<string, { status: string; revision: number; lastModifiedAt?: string | null }>>(new Map());

  // Oturum ve Mutfak Restoranı Kontrolü
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
      } catch (err) {
        console.error("Kitchen init error:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Restoran Seçilmemişse (Birden fazla yetkisi olan mutfak kullanıcısı veya admin/şef)
  const handleSelectKitchenRestaurant = async (restaurantIdOrCode: string) => {
    setLoading(true);
    try {
      const res = await selectRestaurantAction(restaurantIdOrCode);
      if (res.success && res.restaurant) {
        setSession((prev) => ({
          ...(prev || {
            id: "kitchen",
            name: "Mutfak",
            username: "mutfak",
            role: "KITCHEN",
          }),
          activeRestaurantId: res.restaurant.id,
          activeRestaurantName: res.restaurant.name,
        }));
      } else {
        alert("Restoran seçilemedi: " + (res.error || "Bilinmeyen hata"));
      }
    } catch (err: any) {
      console.error("handleSelectKitchenRestaurant error:", err);
      alert("Hata oluştu: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Restoran Değiştir
  const handleSwitchRestaurant = async () => {
    setLoading(true);
    try {
      await clearActiveRestaurantAction();
      setSession((prev) => prev ? { ...prev, activeRestaurantId: null, activeRestaurantName: null } : null);
      setOrders([]);
    } catch (err) {
      console.error("handleSwitchRestaurant error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Otomatik yazdırılan sipariş ID'lerini takip et (aynı sipariş 2 kez basılmasın)
  const autoPrintedIdsRef = useRef<Set<string>>(new Set());
  // Yazdırma kuyruğu (birden fazla sipariş aynı anda gelirse sırayla bas)
  const printQueueRef = useRef<any[]>([]);
  const isPrintingRef = useRef(false);

  const processNextPrint = () => {
    if (isPrintingRef.current || printQueueRef.current.length === 0) return;
    const nextOrder = printQueueRef.current.shift();
    if (!nextOrder) return;
    isPrintingRef.current = true;
    setPrintingOrder(nextOrder);
    fetch("/api/kitchen/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: nextOrder.id, action: "print" }),
    }).catch(console.error);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setPrintingOrder(null);
        isPrintingRef.current = false;
        // Kuyrukta başka sipariş varsa 600ms sonra bir sonrakini bas
        if (printQueueRef.current.length > 0) {
          setTimeout(processNextPrint, 600);
        }
      }, 500);
    }, 400);
  };

  // Siparişleri Çek (Yeni veya Güncellenen Siparişleri Anında Algılar)
  const fetchOrders = async () => {
    if (!session?.activeRestaurantId) return;

    try {
      const res = await fetch(`/api/kitchen/orders?restaurantId=${session.activeRestaurantId}`);
      const data = await res.json();

      if (data.success && data.data) {
        const newOrders = data.data;

        // 1. Yepyeni düşen sipariş (ID haritamızda yok)
        const brandNewOrders = newOrders.filter(
          (o: any) => !previousOrdersMapRef.current.has(o.id) && o.status === "PENDING"
        );

        // 2. Güncellenen / İlave eklenen sipariş (ID haritamızda var ama revizyonu veya son düzenlenme zamanı artmış)
        const updatedOrdersList: any[] = [];
        newOrders.forEach((o: any) => {
          const prev = previousOrdersMapRef.current.get(o.id);
          if (prev) {
            const hasNewRevision = (o.revision || 1) > (prev.revision || 1);
            const hasNewModifiedTime =
              o.lastModifiedAt &&
              prev.lastModifiedAt &&
              new Date(o.lastModifiedAt).getTime() > new Date(prev.lastModifiedAt).getTime();
            const wasJustUpdated = o.isUpdated && (hasNewRevision || hasNewModifiedTime);

            if (wasJustUpdated && o.status === "PENDING") {
              updatedOrdersList.push(o);
            }
          }
        });

        const hasNewIncoming = brandNewOrders.length > 0;
        const hasIncomingUpdate = updatedOrdersList.length > 0;

        // Sesli uyarı & Oto Yazdırma tetikleme (İlk yükleme hariç)
        if ((hasNewIncoming || hasIncomingUpdate) && previousOrdersMapRef.current.size > 0) {
          if (soundEnabled) playKitchenChime();

          if (autoPrintEnabled) {
            // Daha önce yazdırılmamış siparişleri kuyruğa ekle
            const allToPrint = [...updatedOrdersList, ...brandNewOrders];
            let added = false;
            for (const order of allToPrint) {
              if (!autoPrintedIdsRef.current.has(order.id + "_" + (order.revision || 1))) {
                autoPrintedIdsRef.current.add(order.id + "_" + (order.revision || 1));
                printQueueRef.current.push(order);
                added = true;
              }
            }
            if (added) processNextPrint();
          }
        }

        // Haritayı güncelle
        const nextMap = new Map<string, { status: string; revision: number; lastModifiedAt?: string | null }>();
        newOrders.forEach((o: any) => {
          nextMap.set(o.id, {
            status: o.status,
            revision: o.revision || 1,
            lastModifiedAt: o.lastModifiedAt,
          });
        });
        previousOrdersMapRef.current = nextMap;

        setOrders(newOrders);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error("fetchOrders error:", err);
    }
  };

  useEffect(() => {
    if (session?.activeRestaurantId) {
      fetchOrders();
      const interval = setInterval(fetchOrders, 3500);
      return () => clearInterval(interval);
    }
  }, [session?.activeRestaurantId, soundEnabled, autoPrintEnabled]);

  // Durum Güncelleme
  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/kitchen/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchOrders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Doğrudan Arka Planda Yazdırma (Manuel Yazdır butonu için)
  const handleDirectPrintTicket = (order: any) => {
    printQueueRef.current.push(order);
    processNextPrint();
  };

  // Manuel Yazdırma Önizleme Modalını Aç
  const handleOpenPrintPreview = (order: any) => {
    setPreviewOrder(order);
    setPrintingOrder(order);
  };

  // Önizleme Modalından Yazıcıya Gönder
  const handleExecutePrintFromPreview = async () => {
    if (!previewOrder) return;
    const targetOrder = previewOrder;

    fetch("/api/kitchen/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: targetOrder.id, action: "print" }),
    }).catch(console.error);

    // Listede hemen basıldı durumunu göster
    setOrders((prev) =>
      prev.map((o) =>
        o.id === targetOrder.id ? { ...o, printedAt: new Date().toISOString() } : o
      )
    );

    // Önizleme modalını kapat, yazdırma verisini set et, DOM render bekle
    setPreviewOrder(null);
    setPrintingOrder(targetOrder);

    setTimeout(() => {
      window.print();
      // Yazdırmadan sonra temizle
      setTimeout(() => setPrintingOrder(null), 500);
    }, 400);
  };

  const getElapsedMinutes = (dateStr: string) => {
    const elapsed = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    return Math.max(0, elapsed);
  };

  const currentTheme = getRestaurantTheme(session?.activeRestaurantName);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-[#070a12]">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // ===========================================================================
  // DURUM 1: MUTFAK KULLANICISI HENÜZ RESTORAN SEÇMEDİYSE
  // ===========================================================================
  if (!session?.activeRestaurantId) {
    return (
      <div className="flex-1 flex flex-col p-4 sm:p-8 max-w-4xl mx-auto w-full justify-center">
        {/* Üst Bar: Kullanıcı Bilgisi ve Çıkış Butonu */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ChefHat className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">MUTFAK TERMİNALİ</span>
              <span className="text-xs text-zinc-300">
                Giriş Yapan: <strong className="text-white">{session?.name}</strong>
              </span>
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-bold hover:bg-rose-900/60 transition-all shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Çıkış Yap</span>
            </button>
          </form>
        </div>

        <div className="text-center mb-8">
          <span className="text-xs uppercase tracking-widest text-emerald-400 font-bold block mb-1">
            MUTFAK İSTASYONU SEÇİMİ
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Sayın {session?.name}, Hangi Alakartın Mutfağını Açmak İstiyorsunuz?
          </h2>
          <p className="text-zinc-400 text-xs sm:text-sm mt-1">
            Her alakart restoranın mutfak ekranı ve termal adisyon yazıcısı tamamen bağımsızdır. Lütfen görevli olduğunuz alakartı seçin.
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
              onClick={() => handleSelectKitchenRestaurant(item.id)}
              className={clsx(
                "p-5 rounded-3xl border text-left transition-all active:scale-[0.98] group flex flex-col justify-between",
                item.theme.bgDark,
                item.theme.border,
                item.theme.glow,
                "hover:ring-2 hover:ring-emerald-400/50"
              )}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl">{item.theme.iconEmoji}</span>
                  <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full border", item.theme.badge)}>
                    {item.code}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white group-hover:text-emerald-300 transition-colors">
                  {item.name} Mutfağı (KDS)
                </h3>
                <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                  {item.description || item.theme.subtitle}
                </p>
              </div>

              <div className="pt-4 border-t border-zinc-800/80 mt-4 flex items-center justify-between text-xs font-bold text-emerald-400">
                <span>Mutfak Ekranını Başlat</span>
                <span>➔</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ===========================================
  // DURUM 2: RESTORAN KİLİTLİ VE MUTFAK KDS EKRANI
  // ===========================================
  // ===========================================
  // DURUM 2: RESTORAN KİLİTLİ VE MUTFAK KDS EKRANI
  // ===========================================
  const filteredOrders = orders
    .filter((o) => {
      if (statusFilter === "ACTIVE") return o.status === "PENDING" || o.status === "PREPARING";
      if (statusFilter === "PENDING") return o.status === "PENDING";
      if (statusFilter === "UPDATED") return (o.isUpdated || (o.revision && o.revision > 1)) && (o.status === "PENDING" || o.status === "PREPARING");
      if (statusFilter === "PREPARING") return o.status === "PREPARING";
      if (statusFilter === "COMPLETED") return o.status === "COMPLETED";
      return true;
    })
    .sort((a, b) => {
      const statusWeight: Record<string, number> = {
        PENDING: 1,
        PREPARING: 2,
        COMPLETED: 3,
        CANCELLED: 4,
      };
      const weightDiff = (statusWeight[a.status] || 99) - (statusWeight[b.status] || 99);
      if (weightDiff !== 0) return weightDiff;
      if (a.status === "COMPLETED") {
        return new Date(b.completedAt || b.updatedAt).getTime() - new Date(a.completedAt || a.updatedAt).getTime();
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  return (
    <div className={clsx("flex-1 flex flex-col p-4 sm:p-6 max-w-7xl mx-auto w-full", currentTheme.bgDark)}>
      {/* Sabit Mutfak Header (Karışıklığı Önleyen Özel Renkli KDS Barı) */}
      <div className={clsx("sticky top-14 z-40 border rounded-3xl p-4 sm:p-5 mb-6 shadow-2xl backdrop-blur-md", currentTheme.border, currentTheme.cardBg)}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl sm:text-4xl">{currentTheme.iconEmoji}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className={clsx("text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded border", currentTheme.badge)}>
                  SEÇİLEN ALAKART
                </span>
                <span className="text-[11px] text-zinc-400 hidden sm:inline">Mutfak KDS Terminali</span>
              </div>
              <h2 className="text-lg sm:text-2xl font-black text-white mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="text-zinc-400 text-xs sm:text-sm font-bold">Seçilen Alakart:</span>
                <span className={clsx("font-extrabold", currentTheme.textAccent)}>
                  {session.activeRestaurantName || currentTheme.name}
                </span>
              </h2>
            </div>
          </div>

          {/* Quick Action Toggles & Logout */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Ses Açık/Kapalı */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                if (!soundEnabled) playKitchenChime();
              }}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all",
                soundEnabled
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-500"
              )}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-zinc-500" />}
              <span className="hidden sm:inline">{soundEnabled ? "Zil Açık" : "Zil Kapalı"}</span>
            </button>

            {/* Otomatik Yazdırma */}
            <button
              onClick={() => setAutoPrintEnabled(!autoPrintEnabled)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all",
                autoPrintEnabled
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400"
              )}
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Oto Yazdır: {autoPrintEnabled ? "Açık" : "Manuel"}</span>
            </button>

            <button
              onClick={fetchOrders}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Restorandan Güvenli Çıkış */}
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-bold hover:bg-rose-900/60"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Çıkış Yap</span>
              </button>
            </form>
          </div>
        </div>

        {/* Filtre Sekmeleri */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-zinc-800/80 overflow-x-auto pb-1">
          <span className="text-xs text-zinc-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filtre:
          </span>
          {[
            { key: "ACTIVE", label: "Aktif Siparişler", count: orders.filter((o) => o.status === "PENDING" || o.status === "PREPARING").length },
            { key: "PENDING", label: "Bekleyenler (Ocak Bekliyor)", count: orders.filter((o) => o.status === "PENDING").length },
            { key: "UPDATED", label: "⚠️ Güncellenenler (Revizyon)", count: orders.filter((o) => (o.isUpdated || (o.revision && o.revision > 1)) && (o.status === "PENDING" || o.status === "PREPARING")).length },
            { key: "PREPARING", label: "Hazırlanıyor", count: orders.filter((o) => o.status === "PREPARING").length },
            { key: "COMPLETED", label: "✓ Tamamlananlar", count: orders.filter((o) => o.status === "COMPLETED").length },
            { key: "ALL", label: "Tümü", count: orders.length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={clsx(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5",
                statusFilter === tab.key
                  ? "bg-amber-500 text-zinc-950 shadow-sm"
                  : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
              )}
            >
              <span>{tab.label}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Sipariş Kartları */}
      {filteredOrders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 rounded-3xl bg-zinc-900/30 border border-zinc-800/60 text-center">
          <ChefHat className="w-12 h-12 text-zinc-600 mb-3" />
          <h3 className="text-base font-bold text-white mb-1">
            {session.activeRestaurantName} İçin Bu Filtrede Sipariş Bulunmuyor
          </h3>
          <p className="text-zinc-500 text-xs max-w-sm">
            Garson masadan yeni veya güncellenmiş bir sipariş gönderdiğinde sesli otel zili çalacak ve bu ekrana düşecektir.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => {
            const elapsed = getElapsedMinutes(order.createdAt);
            const isUrgent = elapsed >= 12;
            const isPreparing = order.status === "PREPARING";
            const isCompleted = order.status === "COMPLETED";
            const isOrderUpdated = Boolean(order.isUpdated || (order.revision && order.revision > 1));
            const updateElapsed = order.lastModifiedAt ? getElapsedMinutes(order.lastModifiedAt) : null;

            return (
              <div
                key={order.id}
                className={clsx(
                  "rounded-3xl border transition-all flex flex-col justify-between overflow-hidden shadow-xl",
                  isCompleted
                    ? "bg-[#0a1a14]/70 border-emerald-500/50 shadow-emerald-500/5"
                    : isOrderUpdated
                    ? "bg-[#18140a] border-amber-400 ring-2 ring-amber-400/50 shadow-2xl shadow-amber-500/10"
                    : isPreparing
                    ? "bg-[#0b1424] border-blue-500/40"
                    : isUrgent
                    ? "bg-[#1f0f12] border-rose-500/60 ring-1 ring-rose-500/40"
                    : "bg-[#111726] border-amber-500/30"
                )}
              >
                {/* Durum Rozeti */}
                {isCompleted ? (
                  <div className="bg-emerald-500/20 border-b border-emerald-500/40 text-emerald-300 px-3.5 py-1.5 font-bold text-xs flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>MUTFAK TAMAMLADI • SERVİSE HAZIR</span>
                    </div>
                    {order.completedAt && (
                      <span className="font-mono text-[11px] text-emerald-400/80">
                        {new Date(order.completedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                ) : isOrderUpdated ? (
                  <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-zinc-950 px-3.5 py-1.5 font-black text-xs flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">⚠️</span>
                      <span>SİPARİŞ DÜZENLENDİ / İLAVE GELDİ</span>
                    </div>
                    <span className="font-mono text-[11px] bg-black/25 px-2 py-0.5 rounded font-black tracking-wider">
                      REVİZYON #{order.revision || 2}
                    </span>
                  </div>
                ) : null}

                {/* Header */}
                <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-amber-400 block tracking-wider uppercase">
                      {order.restaurant?.name}
                    </span>
                    <h3 className="text-2xl font-black text-white flex items-center gap-2">
                      <span>{order.table?.name}</span>
                      <span className="text-xs font-mono font-normal text-zinc-500">
                        #{order.orderNumber}
                      </span>
                      {isOrderUpdated && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/50">
                          Rev. #{order.revision || 2}
                        </span>
                      )}
                    </h3>
                  </div>

                  <div className="text-right">
                    <div
                      className={clsx(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold font-mono",
                        isCompleted
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : isUrgent
                          ? "bg-rose-500 text-white animate-pulse"
                          : isPreparing
                          ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      )}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{isCompleted ? "Tamamlandı" : `${elapsed} dk`}</span>
                    </div>
                    {isOrderUpdated && updateElapsed !== null && (
                      <span className="text-[10px] text-amber-300 font-bold block mt-0.5">
                        Güncelleme: {updateElapsed === 0 ? "Az önce" : `${updateElapsed} dk önce`}
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-400 block mt-0.5">
                      Garson: {order.waiter?.name}
                    </span>
                  </div>
                </div>

                {/* Masa Notu */}
                {order.notes && (
                  <div
                    className={clsx(
                      "p-2.5 mx-3 mt-3 rounded-xl border text-xs font-medium",
                      isOrderUpdated
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-200"
                        : "bg-amber-500/10 border-amber-500/20 text-amber-300"
                    )}
                  >
                    📌 <strong>{isOrderUpdated ? "Güncel Masa Notu:" : "Masa Notu:"}</strong> {order.notes}
                  </div>
                )}

                {/* Kalemler Başlığı & Listesi */}
                <div className="px-4 pt-3 pb-1 flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="font-bold uppercase tracking-wider text-zinc-500">
                    {isOrderUpdated ? "Güncel Sipariş Kalemleri" : "Sipariş Kalemleri"}
                  </span>
                  <span className="font-mono text-amber-400 font-bold">
                    {order.items?.length || 0} Çeşit Ürün
                  </span>
                </div>

                <div className="p-4 pt-1 space-y-2.5 flex-1">
                  {order.items?.map((item: any) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex items-start justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-amber-500 text-zinc-950 font-black text-xs flex items-center justify-center">
                            {item.quantity}x
                          </span>
                          <span className="text-sm font-bold text-white">
                            {item.menuItem?.name}
                          </span>
                        </div>

                        {item.itemNotes && (
                          <div className="mt-1 ml-8">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-400 text-zinc-950 inline-block shadow-sm">
                              👉 {item.itemNotes}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Butonlar */}
                <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenPrintPreview(order)}
                    className={clsx(
                      "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95",
                      isOrderUpdated
                        ? "bg-amber-500/20 border border-amber-500/50 text-amber-300 hover:bg-amber-500/30"
                        : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                    )}
                  >
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isOrderUpdated ? `Fişi Önizle & Yazdır (Rev #${order.revision || 2})` : "Yazdır / Önizle"}</span>
                    {order.printedAt && <Check className="w-3 h-3 text-emerald-400" />}
                  </button>

                  <div className="flex items-center gap-2">
                    {order.status === "PENDING" && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, "PREPARING")}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all active:scale-95"
                      >
                        <Flame className="w-3.5 h-3.5" />
                        <span>Hazırlanıyor</span>
                      </button>
                    )}

                    {!isCompleted ? (
                      <button
                        onClick={() => handleUpdateStatus(order.id, "COMPLETED")}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-black transition-all active:scale-95 shadow-md shadow-emerald-500/20"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Tamamlandı</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Tamamlandı</span>
                        </span>
                        <button
                          onClick={() => handleUpdateStatus(order.id, "PREPARING")}
                          className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium border border-zinc-700 transition"
                          title="Gerekirse tekrar hazırlanıyor durumuna al"
                        >
                          Geri Al (Ocak)
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

      {/* ======================================================== */}
      {/* MANUEL YAZDIRMA ÖNİZLEMESİ MODALI (80mm TERMAL ADİSYON)    */}
      {/* ======================================================== */}
      {previewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
            {/* Modal Üst Barı */}
            <div className="flex items-center justify-between px-5 py-4 bg-zinc-950 border-b border-zinc-800 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Yazdırma Önizlemesi</span>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                      80mm Termal Adisyon
                    </span>
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    {previewOrder.restaurant?.name} • Masa {previewOrder.table?.name} (#{previewOrder.orderNumber})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setPreviewOrder(null)}
                className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition"
                title="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Termal Kağıt Fiş Önizlemesi */}
            <div className="p-4 sm:p-6 overflow-y-auto bg-zinc-950/70 flex-1 flex justify-center items-start">
              <div className="w-full max-w-[330px] bg-white text-zinc-950 font-mono shadow-2xl rounded-sm p-5 border border-zinc-300 relative text-left select-none">
                {/* Üst Tırtıklı Kenar Görünümü */}
                <div className="border-b-2 border-dashed border-zinc-300 -mt-2 mb-3"></div>

                {/* Başlık */}
                <div
                  className={clsx(
                    "text-center pb-2 mb-2",
                    (previewOrder.isUpdated || (previewOrder.revision && previewOrder.revision > 1))
                      ? "border-b-2 border-black"
                      : "border-b border-dashed border-zinc-400"
                  )}
                >
                  <div className="text-[10px] tracking-widest text-zinc-500 uppercase font-sans font-bold">
                    MUTFAK ADİSYON FİŞİ
                  </div>
                  <h2 className="text-base font-black tracking-tight leading-tight mt-0.5">
                    MERİT HOTELS & RESORTS
                  </h2>
                  <div className="text-xs font-bold text-zinc-800 uppercase mt-0.5">
                    {previewOrder.restaurant?.name}
                  </div>

                  {/* Revizyon / İlave Uyarısı */}
                  {(previewOrder.isUpdated || (previewOrder.revision && previewOrder.revision > 1)) ? (
                    <div className="my-2 border-2 border-black p-2 bg-black text-white text-center">
                      <div className="text-xs font-black tracking-wider">*** GÜNCELLENEN SİPARİŞ ***</div>
                      <div className="text-[11px] font-bold">REVİZYON #{previewOrder.revision || 2} - İLAVE / DÜZENLEME</div>
                      <div className="text-[9px] mt-0.5 opacity-90">DİKKAT: ESKİ FİŞİ İPTAL EDİNİZ, BU GÜNCEL FİŞTİR!</div>
                    </div>
                  ) : (
                    <div className="text-[11px] font-semibold mt-1">*** MUTFAK SİPARİŞ FİŞİ ***</div>
                  )}
                </div>

                {/* Masa & Garson & Zaman Bilgileri */}
                <div className="border-b border-dashed border-zinc-400 pb-2 mb-2 text-xs space-y-1">
                  <div className="flex justify-between items-baseline font-bold text-base">
                    <span>MASA: {previewOrder.table?.name}</span>
                    <span>
                      #{previewOrder.orderNumber}
                      {(previewOrder.isUpdated || (previewOrder.revision && previewOrder.revision > 1)) && (
                        <span className="text-xs ml-1">(REV #{previewOrder.revision || 2})</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-700 text-[11px]">
                    <span>Garson: <strong>{previewOrder.waiter?.name}</strong></span>
                    <span>
                      Saat: {new Date(previewOrder.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {previewOrder.isUpdated && previewOrder.lastModifiedAt && (
                    <div className="text-[11px] font-bold bg-zinc-100 p-1 rounded border border-zinc-300">
                      🔄 Güncelleme: {new Date(previewOrder.lastModifiedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </div>
                  )}
                  {previewOrder.notes && (
                    <div className="mt-1.5 p-1.5 border border-black font-bold text-[11px] bg-zinc-50 leading-snug">
                      📌 {previewOrder.isUpdated ? "GÜNCEL MASA NOTU:" : "MASA NOTU:"} {previewOrder.notes}
                    </div>
                  )}
                </div>

                {/* Kalemler */}
                <div className="border-b border-dashed border-zinc-400 pb-2 mb-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5 border-b border-zinc-300 pb-1 flex justify-between">
                    <span>{(previewOrder.isUpdated || (previewOrder.revision && previewOrder.revision > 1)) ? "GÜNCEL SİPARİŞ KALEMLERİ" : "SİPARİŞ KALEMLERİ"}</span>
                    <span>{previewOrder.items?.length || 0} Çeşit</span>
                  </div>

                  <div className="space-y-2">
                    {previewOrder.items?.map((it: any, idx: number) => (
                      <div key={idx} className="leading-snug">
                        <div className="text-[13px] font-black flex items-start justify-between">
                          <span>
                            <strong className="text-base mr-1.5">{it.quantity}x</strong>
                            {it.menuItem?.name}
                          </span>
                        </div>
                        {it.itemNotes && (
                          <div className="text-[11px] font-bold pl-5 text-zinc-800">
                            &gt;&gt; ÖZEL: <span className="underline decoration-dotted">{it.itemNotes}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Alt Bilgi */}
                <div className="text-center text-[10px] text-zinc-600 pt-1">
                  {(previewOrder.isUpdated || (previewOrder.revision && previewOrder.revision > 1)) && (
                    <div className="font-bold border border-dashed border-black p-1 text-black">
                      * REVİZYON #{previewOrder.revision || 2} - LÜTFEN ÖNCEKİ FİŞİ İPTAL EDİNİZ *
                    </div>
                  )}
                </div>

                {/* Alt Tırtıklı Kenar Görünümü */}
                <div className="border-b-2 border-dashed border-zinc-300 -mb-2 mt-3"></div>
              </div>
            </div>

            {/* Modal Butonları */}
            <div className="flex items-center justify-between p-4 bg-zinc-950 border-t border-zinc-800 gap-3 shrink-0">
              <button
                onClick={() => setPreviewOrder(null)}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition"
              >
                Kapat
              </button>

              <button
                onClick={handleExecutePrintFromPreview}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 text-xs font-black shadow-lg shadow-amber-500/20 active:scale-95 transition"
              >
                <Printer className="w-4 h-4" />
                <span>Yazıcıya Gönder (Yazdır)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 80mm Termal Adisyon Gizli Yazdırma Şablonu */}
      {printingOrder && (
        <div id="printable-kitchen-ticket" className="hidden">
          <div
            style={{
              textAlign: "center",
              borderBottom: (printingOrder.isUpdated || (printingOrder.revision && printingOrder.revision > 1)) ? "2px solid #000" : "1px dashed #000",
              paddingBottom: "6px",
              marginBottom: "8px",
            }}
          >
            <h2 style={{ fontSize: "16px", fontWeight: "bold", margin: "0 0 2px 0" }}>MERİT HOTELS & RESORTS</h2>
            <div style={{ fontSize: "13px", fontWeight: "bold" }}>{printingOrder.restaurant?.name}</div>

            {printingOrder.isUpdated || (printingOrder.revision && printingOrder.revision > 1) ? (
              <div
                style={{
                  margin: "5px 0",
                  border: "2px solid #000",
                  padding: "4px",
                  backgroundColor: "#000",
                  color: "#fff",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: "bold", letterSpacing: "1px" }}>
                  *** GÜNCELLENEN SİPARİŞ ***
                </div>
                <div style={{ fontSize: "11px", fontWeight: "bold" }}>
                  REVİZYON #{printingOrder.revision || 2} - İLAVE / DEĞİŞİKLİK
                </div>
                <div style={{ fontSize: "9px", marginTop: "2px" }}>
                  DİKKAT: ESKİ FİŞİ İPTAL EDİNİZ, BU GÜNCEL FİŞTİR!
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "11px", margin: "4px 0" }}>*** MUTFAK SİPARİŞ FİŞİ ***</div>
            )}
          </div>

          <div style={{ borderBottom: "1px dashed #000", paddingBottom: "6px", marginBottom: "8px", fontSize: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", fontWeight: "bold" }}>
              <span>MASA: {printingOrder.table?.name}</span>
              <span>
                #{printingOrder.orderNumber}
                {(printingOrder.isUpdated || (printingOrder.revision && printingOrder.revision > 1)) && (
                  <span style={{ fontSize: "12px", marginLeft: "4px" }}>(REV #{printingOrder.revision || 2})</span>
                )}
              </span>
            </div>
            <div>Garson: {printingOrder.waiter?.name}</div>
            <div>İlk Sipariş: {new Date(printingOrder.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</div>
            {printingOrder.isUpdated && printingOrder.lastModifiedAt && (
              <div style={{ fontWeight: "bold" }}>
                GÜNCELLEME: {new Date(printingOrder.lastModifiedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
            {printingOrder.notes && (
              <div style={{ marginTop: "4px", fontWeight: "bold", border: "1px solid #000", padding: "2px 4px" }}>
                {printingOrder.isUpdated ? "GÜNCEL MASA NOTU:" : "MASA NOTU:"} {printingOrder.notes}
              </div>
            )}
          </div>

          <div style={{ borderBottom: "1px dashed #000", paddingBottom: "8px", marginBottom: "8px" }}>
            <div
              style={{
                fontSize: "11px",
                fontWeight: "bold",
                textTransform: "uppercase",
                marginBottom: "4px",
                borderBottom: "1px solid #000",
                paddingBottom: "2px",
              }}
            >
              {(printingOrder.isUpdated || (printingOrder.revision && printingOrder.revision > 1))
                ? "GÜNCEL SİPARİŞ LİSTESİ"
                : "SİPARİŞ KALEMLERİ"} ({printingOrder.items?.length || 0} ÇEŞİT):
            </div>
            {printingOrder.items?.map((it: any, idx: number) => (
              <div key={idx} style={{ marginBottom: "6px" }}>
                <div style={{ fontSize: "14px", fontWeight: "bold" }}>
                  {it.quantity}x {it.menuItem?.name}
                </div>
                {it.itemNotes && (
                  <div style={{ fontSize: "12px", fontWeight: "bold", paddingLeft: "10px" }}>
                    &gt;&gt; ÖZEL: {it.itemNotes}
                  </div>
                )}
              </div>
            ))}
          </div>

          {(printingOrder.isUpdated || (printingOrder.revision && printingOrder.revision > 1)) && (
              <div style={{ textAlign: "center", fontSize: "10px", marginTop: "6px" }}>
                <div style={{ fontWeight: "bold", border: "1px dashed #000", padding: "3px" }}>
                  * REVİZYON #{printingOrder.revision || 2} - LÜTFEN ÖNCEKİ FİŞİ İPTAL EDİNİZ *
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
