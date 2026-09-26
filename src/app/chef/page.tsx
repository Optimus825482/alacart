"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import {
  ChefHat,
  Clock,
  TrendingUp,
  FileSpreadsheet,
  Printer,
  Calendar,
  Filter,
  RefreshCw,
  Utensils,
  CheckCircle2,
  AlertCircle,
  Shield,
  Layers,
  Search,
  ExternalLink,
  Users,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Send,
} from "lucide-react";
import * as XLSX from "xlsx";
import clsx from "clsx";
import { getRestaurants, getTables, getCategoriesTree } from "@/actions/definitions";
import { createOrder, getRestaurantWaiters, updateOrderStatus, markOrderPrinted } from "@/actions/orders";
import {
  getChefMasterKds,
  getChefAnalyticsAndReport,
  getAuditLogs,
  getWaiterSessionsAndLogins,
  getLiveServiceSnapshot,
} from "@/actions/chef";
import { todayInTimeZone, describeDateRange, formatInTimeZone } from "@/lib/date-range";
import { getSessionUser } from "@/actions/auth";
import { RESTAURANT_THEMES } from "@/lib/themes";
import { ChefAnalyticsPrintReport, ChefAuditPrintReport } from "./chef-print-report";

export default function ChefModulePage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"kds" | "orderEntry" | "waiters" | "analytics" | "audit">("kds");
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>("ALL");

  // Master KDS state
  const [kdsOrders, setKdsOrders] = useState<any[]>([]);
  const [loadingKds, setLoadingKds] = useState(true);
  const [autoRefreshKds, setAutoRefreshKds] = useState(true);

  // Waiter sessions & login tracking state
  const [waiterData, setWaiterData] = useState<{ waiters: any[]; history: any[] }>({ waiters: [], history: [] });
  const [loadingWaiters, setLoadingWaiters] = useState(false);
  const [waiterSearchQuery, setWaiterSearchQuery] = useState("");

  // Date range reporting state
  const todayStr = todayInTimeZone();
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [reportData, setReportData] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Audit logs state
  const [liveSnapshot, setLiveSnapshot] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [selectedAuditAction, setSelectedAuditAction] = useState<string>("ALL");
  const [loadingAudit, setLoadingAudit] = useState(false);

  const [isPending, startTransition] = useTransition();

  // ================= SİPARİŞ GİRİŞİ (ŞEF) =================
  // Şef, restoran seçerek sipariş girer. Garson mutfağa bağlanır;
  // siparişi alan garson açıkça seçilir (Order.waiterId zorunludur).
  type SepetKalemi = { menuItemId: string; name: string; quantity: number; itemNotes: string };
  const [entryRestaurantId, setEntryRestaurantId] = useState<string>("");
  const [entryTables, setEntryTables] = useState<any[]>([]);
  const [entryWaiters, setEntryWaiters] = useState<any[]>([]);
  const [entryTableId, setEntryTableId] = useState<string>("");
  const [entryWaiterId, setEntryWaiterId] = useState<string>("");
  const [entryCategories, setEntryCategories] = useState<any[]>([]);
  const [entrySearch, setEntrySearch] = useState("");
  const [entryCart, setEntryCart] = useState<SepetKalemi[]>([]);
  const [entryNotes, setEntryNotes] = useState("");
  const [entrySubmitting, setEntrySubmitting] = useState(false);
  const [entryMessage, setEntryMessage] = useState<{ tip: "ok" | "hata"; metin: string } | null>(null);

  const loadEntryData = async (restaurantId: string) => {
    if (!restaurantId) return;
    const [tablesRes, catsRes, waitersRes] = await Promise.all([
      getTables(restaurantId),
      getCategoriesTree(restaurantId),
      getRestaurantWaiters(restaurantId),
    ]);
    if (tablesRes.success && tablesRes.data) setEntryTables(tablesRes.data);
    if (catsRes.success && catsRes.data) setEntryCategories(catsRes.data);
    if (waitersRes.success && waitersRes.data) {
      setEntryWaiters(waitersRes.data);
      setEntryWaiterId((prev) =>
        prev && waitersRes.data.some((w: any) => w.id === prev)
          ? prev
          : waitersRes.data[0]?.id || ""
      );
    }
  };

  useEffect(() => {
    if (activeTab !== "orderEntry") return;
    if (!entryRestaurantId && restaurants.length > 0) {
      setEntryRestaurantId(restaurants[0].id);
    }
  }, [activeTab, restaurants, entryRestaurantId]);

  useEffect(() => {
    if (activeTab !== "orderEntry") return;
    setEntryCart([]);
    setEntryTableId("");
    setEntryMessage(null);
    loadEntryData(entryRestaurantId);
  }, [activeTab, entryRestaurantId]);

  // Kategori agacindan duz urun listesi (alt klasorlar dahil)
  const entryUrunler = useMemo(() => {
    const urunler: any[] = [];
    const gez = (nodes: any[]) => {
      for (const n of nodes || []) {
        if (Array.isArray(n.items) && n.items.length > 0) urunler.push(...n.items);
        if (n.children) gez(n.children);
      }
    };
    gez(entryCategories);
    return urunler;
  }, [entryCategories]);

  const entryGorunenUrunler = useMemo(() => {
    const q = entrySearch.trim().toLocaleLowerCase("tr-TR");
    if (!q) return entryUrunler;
    return entryUrunler.filter((
      u: any
    ) =>
      (u.name || "").toLocaleLowerCase("tr-TR").includes(q) ||
      (u.allergens || "").toLocaleLowerCase("tr-TR").includes(q)
    );
  }, [entryUrunler, entrySearch]);

  const entrySepetToplam = entryCart.reduce((t, k) => t + k.quantity, 0);

  const entryEkle = (item: any) => {
    setEntryCart((oncekiler) => {
      const varOlan = oncekiler.find((k) => k.menuItemId === item.id);
      if (varOlan) {
        return oncekiler.map((k) =>
          k.menuItemId === item.id ? { ...k, quantity: k.quantity + 1 } : k
        );
      }
      return [
        ...oncekiler,
        {
          menuItemId: item.id,
          name: item.name,
          quantity: 1,
          itemNotes: "",
        },
      ];
    });
  };

  const entryAdetDegistir = (menuItemId: string, delta: number) => {
    setEntryCart((oncekiler) =>
      oncekiler
        .map((k) =>
          k.menuItemId === menuItemId
            ? { ...k, quantity: k.quantity + delta }
            : k
        )
        .filter((k) => k.quantity > 0)
    );
  };

  const entryNotDegistir = (menuItemId: string, not: string) => {
    setEntryCart((oncekiler) =>
      oncekiler.map((k) =>
        k.menuItemId === menuItemId ? { ...k, itemNotes: not } : k
      ),
    );
  };

  const entryKaldir = (menuItemId: string) => {
    setEntryCart((oncekiler) => oncekiler.filter((k) => k.menuItemId !== menuItemId));
  };

  const entrySiparisVer = async () => {
    if (!entryRestaurantId || !entryTableId || !entryWaiterId) {
      setEntryMessage({
        tip: "hata",
        metin: "Restoran, masa ve garson seçimi zorunludur.",
      });
      return;
    }
    if (entryCart.length === 0) {
      setEntryMessage({ tip: "hata", metin: "Sepete en az bir ürün ekleyin." });
      return;
    }
    setEntrySubmitting(true);
    setEntryMessage(null);
    const res = await createOrder({
      restaurantId: entryRestaurantId,
      tableId: entryTableId,
      waiterId: entryWaiterId,
      notes: entryNotes.trim() || undefined,
      items: entryCart.map((k) => ({
        menuItemId: k.menuItemId,
        quantity: k.quantity,
        itemNotes: k.itemNotes.trim() || undefined,
      })),
    });
    setEntrySubmitting(false);
    if (!res.success) {
      setEntryMessage({ tip: "hata", metin: res.error || "Sipariş oluşturulamadı." });
      return;
    }
    const no = res.data?.orderNumber;
    setEntryMessage({
      tip: "ok",
      metin: `Sipariş #${no} mutfağa iletildi. Durumu yalnızca mutfak ekranından güncellenebilir.`,
    });
    setEntryCart([]);
    setEntryNotes("");
    loadKds();
    loadLive();
  };

  // Load Initial User & Restaurants
  useEffect(() => {
    getSessionUser().then((u) => {
      setCurrentUser(u);
    });
    getRestaurants().then((res) => {
      if (res.success && res.data) {
        setRestaurants(res.data);
      }
    });
  }, []);

  // Fetch KDS orders
  const loadKds = async () => {
    const res = await getChefMasterKds(selectedRestaurantId);
    if (res.success && res.data) {
      setKdsOrders(res.data);
    }
    setLoadingKds(false);
  };

  // Fetch Analytics
  const loadReport = async () => {
    setLoadingReport(true);
    const res = await getChefAnalyticsAndReport({
      restaurantId: selectedRestaurantId,
      startDate,
      endDate,
    });
    if (res.success && res.data) {
      setReportData(res.data);
    }
    setLoadingReport(false);
  };

  // Fetch Audit Logs
  const loadAudit = async () => {
    setLoadingAudit(true);
    const res = await getAuditLogs({
      restaurantId: selectedRestaurantId,
      action: selectedAuditAction,
      limit: 150,
    });
    if (res.success && res.data) {
      setAuditLogs(res.data);
    }
    setLoadingAudit(false);
  };

  // Fetch Live Service Snapshot
  const loadLive = async () => {
    const res = await getLiveServiceSnapshot(selectedRestaurantId);
    if (res.success && res.data) {
      setLiveSnapshot(res.data);
    }
  };

  // Fetch Waiter Sessions & Login Activity
  const loadWaiters = async () => {
    setLoadingWaiters(true);
    const res = await getWaiterSessionsAndLogins({
      restaurantId: selectedRestaurantId,
    });
    if (res.success && res.data) {
      setWaiterData(res.data);
    }
    setLoadingWaiters(false);
  };

  // Reload data on tab or restaurant filter change
  useEffect(() => {
    if (activeTab === "kds") {
      loadKds();
      loadLive();
    } else if (activeTab === "waiters") {
      loadWaiters();
    } else if (activeTab === "analytics") {
      loadReport();
    } else if (activeTab === "audit") {
      loadAudit();
    }
  }, [activeTab, selectedRestaurantId]);

  // Auto-refresh for KDS tab
  useEffect(() => {
    if (activeTab !== "kds" || !autoRefreshKds) return;
    const interval = setInterval(() => {
      loadKds();
      loadLive();
    }, 7000);
    return () => clearInterval(interval);
  }, [activeTab, autoRefreshKds, selectedRestaurantId]);

  // Auto-refresh for Waiters tab (10s)
  useEffect(() => {
    if (activeTab !== "waiters") return;
    const interval = setInterval(() => {
      loadWaiters();
    }, 10000);
    return () => clearInterval(interval);
  }, [activeTab, selectedRestaurantId]);

  // Order status update handler
  const handleStatusChange = async (orderId: string, newStatus: any) => {
    await updateOrderStatus(orderId, newStatus, {
      id: currentUser?.id,
      name: currentUser?.name || "Koordinatör Şef",
      role: "CHEF",
    });
    loadKds();
  };

  const handlePrint = async (orderId: string) => {
    await markOrderPrinted(orderId, {
      id: currentUser?.id,
      name: currentUser?.name || "Koordinatör Şef",
      role: "CHEF",
    });
    window.print();
    loadKds();
  };

  // Excel'e aktar (.xlsx)
  const handleExportExcel = () => {
    if (!reportData || !reportData.orders || reportData.orders.length === 0) {
      alert("Dışa aktarılacak sipariş verisi bulunamadı.");
      return;
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1: Sipariş Detayları ve Süreler
    const ordersSheetData = reportData.orders.map((o: any) => ({
      "Sipariş No": `#${o.orderNumber}`,
      "Alakart Restoran": o.restaurantName,
      "Masa": o.tableName,
      "Garson": o.waiterName,
      "Durum": o.status === "COMPLETED" ? "Tamamlandı" : o.status === "PREPARING" ? "Hazırlanıyor" : o.status === "PENDING" ? "Bekliyor" : "İptal",
      "Ürün Sayısı": o.itemCount,
      "Sipariş İçeriği": o.itemsSummary,
      "Sipariş Saati": new Date(o.createdAt).toLocaleTimeString("tr-TR"),
      "Mutfak Başlama": o.preparingStartedAt ? new Date(o.preparingStartedAt).toLocaleTimeString("tr-TR") : "-",
      "Tamamlanma Saati": o.completedAt ? new Date(o.completedAt).toLocaleTimeString("tr-TR") : "-",
      "Hazırlık Süresi (Dk)": o.prepDurationMinutes !== null ? `${o.prepDurationMinutes} dk` : "-",
      "Özel Notlar": o.notes || "-",
    }));
    const wsOrders = XLSX.utils.json_to_sheet(ordersSheetData);
    XLSX.utils.book_append_sheet(wb, wsOrders, "Siparişler & Süreler");

    // Sheet 2: Popüler Ürünler
    if (reportData.topDishes && reportData.topDishes.length > 0) {
      const topDishesSheet = reportData.topDishes.map((d: any, idx: number) => ({
        "Sıra": idx + 1,
        "Ürün Adı": d.name,
        "Kategori": d.category,
        "Toplam Tüketim Adedi": d.count,
      }));
      const wsDishes = XLSX.utils.json_to_sheet(topDishesSheet);
      XLSX.utils.book_append_sheet(wb, wsDishes, "Popüler Lezzetler");
    }

    // Sheet 3: Garson Performansı
    if (reportData.waiterStats && reportData.waiterStats.length > 0) {
      const waiterSheet = reportData.waiterStats.map((w: any) => ({
        "Garson Adı": w.name,
        "Açılan Sipariş Sayısı": w.count,
      }));
      const wsWaiters = XLSX.utils.json_to_sheet(waiterSheet);
      XLSX.utils.book_append_sheet(wb, wsWaiters, "Garson Performansı");
    }

    const filename = `Merit_Alacarte_Rapor_${startDate}_${endDate}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const selectedRestaurantLabel =
    selectedRestaurantId === "ALL"
      ? "Tüm Alakart Restoranları (Merit Geneli)"
      : restaurants.find((r) => r.id === selectedRestaurantId)?.name || "Tüm Alakart Restoranları";

  // Yazdırma sırasında yalnızca rapor bloğu görünür olur; böylece PDF çıktısı
  // koyu ekran arayüzü değil, okunabilir beyaz sayfa olarak üretilir.
  const printSection = (section: "report" | "audit") => {
    const root = document.documentElement;
    root.setAttribute("data-chef-print", section);

    // Sayfa boyutu global tanımlı olduğu için (mutfak adisyonu 80mm) rapor
    // çıktısı için yazdırma anında geçici olarak A4'e alınır ve sonra kaldırılır.
    const pageOverride = document.createElement("style");
    pageOverride.setAttribute("data-chef-page-override", "true");
    pageOverride.textContent = "@page { size: A4 portrait; margin: 12mm; }";
    document.head.appendChild(pageOverride);

    const restore = () => {
      root.removeAttribute("data-chef-print");
      pageOverride.remove();
    };

    window.addEventListener("afterprint", restore, { once: true });
    window.print();
    setTimeout(restore, 2000);
  };

  const handlePrintReport = () => {
    if (!reportData) {
      alert("Önce raporu yükleyin.");
      return;
    }
    printSection("report");
  };

  const handlePrintAudit = () => {
    if (auditLogs.length === 0) {
      alert("Yazdırılacak denetim kaydı bulunamadı.");
      return;
    }
    printSection("audit");
  };

  // Denetim izlerini Excel'e aktar
  const handleExportAuditExcel = () => {
    if (auditLogs.length === 0) {
      alert("Dışa aktarılacak denetim kaydı bulunamadı.");
      return;
    }

    const rows = auditLogs.map((log) => ({
      "Zaman": formatInTimeZone(log.createdAt),
      "Kullanıcı": log.userName,
      "Rol": log.userRole,
      "İşlem": log.action,
      "Alakart": log.restaurant?.name || "-",
      "Detay": log.details || "-",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Denetim İzleri");
    XLSX.writeFile(
      wb,
      `Merit_Alacarte_Denetim_${selectedRestaurantId === "ALL" ? "TUM_ALAKART" : selectedRestaurantId}.xlsx`
    );
  };

  return (
    <>
      <div id="chef-app-shell" className="min-h-screen bg-[#070a12] text-zinc-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
            <ChefHat className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                MERIT HOTELS & RESORTS
              </span>
              <span className="text-[11px] text-zinc-500 font-mono">
                Ultra Her Şey Dahil A La Carte Koordinasyonu
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
              ŞEF PANELİ
            </h1>
          </div>
        </div>

        {/* Restaurant Selector Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#0f1422] border border-zinc-800 rounded-2xl p-1.5 shadow-md">
            <span className="text-xs text-zinc-400 pl-2 font-semibold flex items-center gap-1">
              <Utensils className="w-3.5 h-3.5 text-amber-400" />
              Restoran:
            </span>
            <select
              value={selectedRestaurantId}
              onChange={(e) => setSelectedRestaurantId(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">🌐 Tüm Alakart Restoranları (Merit Geneli)</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              if (activeTab === "kds") { loadKds(); loadLive(); }
              if (activeTab === "orderEntry") loadEntryData(entryRestaurantId);
              if (activeTab === "waiters") loadWaiters();
              if (activeTab === "analytics") loadReport();
              if (activeTab === "audit") loadAudit();
            }}
            className="p-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all shadow-md"
            title="Verileri Yenile"
          >
            <RefreshCw className={clsx("w-4 h-4", isPending && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab("kds")}
          className={clsx(
            "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-sm",
            activeTab === "kds"
              ? "bg-amber-500 text-zinc-950 shadow-amber-500/20"
              : "bg-[#0f1422] text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800"
          )}
        >
          <Layers className="w-4 h-4" />
          <span>Canlı Master KDS</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-zinc-950/40 text-current ml-1">
            {kdsOrders.length}
          </span>
        </button>


        <button
          onClick={() => setActiveTab("orderEntry")}
          className={clsx(
            "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-sm",
            activeTab === "orderEntry"
              ? "bg-amber-500 text-zinc-950 shadow-amber-500/20"
              : "bg-[#0f1422] text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800"
          )}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Sipariş Girişi</span>
          {entryCart.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-zinc-950/40 text-current ml-1">
              {entrySepetToplam}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("waiters")}
          className={clsx(
            "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-sm",
            activeTab === "waiters"
              ? "bg-amber-500 text-zinc-950 shadow-amber-500/20"
              : "bg-[#0f1422] text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800"
          )}
        >
          <Users className="w-4 h-4" />
          <span>Garson & Alakart Takibi</span>
          {waiterData?.waiters && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-zinc-950/40 text-current ml-1">
              {waiterData.waiters.filter((w: any) => w.isActiveInRestaurant).length} Aktif
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={clsx(
            "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-sm",
            activeTab === "analytics"
              ? "bg-amber-500 text-zinc-950 shadow-amber-500/20"
              : "bg-[#0f1422] text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800"
          )}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Tarih Aralıklı Raporlama & Hazırlık Süreleri</span>
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={clsx(
            "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-sm",
            activeTab === "audit"
              ? "bg-amber-500 text-zinc-950 shadow-amber-500/20"
              : "bg-[#0f1422] text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800"
          )}
        >
          <Shield className="w-4 h-4" />
          <span>Sistem Denetim Logları (Audit)</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: MASTER KDS (CANLI OPERASYON) */}
      {/* ======================================================== */}
      {activeTab === "kds" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-zinc-300">
                Canlı Mutfak Akışı ({kdsOrders.length} Bekleyen / Hazırlanan Sipariş)
              </span>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-400 hover:text-zinc-200">
              <input
                type="checkbox"
                checked={autoRefreshKds}
                onChange={(e) => setAutoRefreshKds(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-0"
              />
              <span>Otomatik Canlı Güncelleme (7 sn)</span>
            </label>
          </div>

          {/* ======================================================== */}
          {/* CANLI SERVİS ÖZETİ (Sistem Yöneticisi ekranından taşınan */}
          {/* canlı sayılar yalnızca Şef Modülünde gösterilir)          */}
          {/* ======================================================== */}
          {liveSnapshot && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <div className="p-4 rounded-3xl bg-[#0f1422] border border-zinc-800">
                <span className="text-zinc-400 text-xs block mb-1">Aktif Sipariş</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-amber-400">
                    {liveSnapshot.activeOrders}
                  </span>
                  <span className="text-xs text-zinc-500 font-medium">Canlı</span>
                </div>
              </div>

              <div className="p-4 rounded-3xl bg-[#0f1422] border border-zinc-800">
                <span className="text-zinc-400 text-xs block mb-1">Bekleyen</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-rose-400">
                    {liveSnapshot.pendingOrders}
                  </span>
                  <span className="text-xs text-zinc-500 font-medium">Sipariş</span>
                </div>
              </div>

              <div className="p-4 rounded-3xl bg-[#0f1422] border border-zinc-800">
                <span className="text-zinc-400 text-xs block mb-1">Hazırlanan</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-sky-400">
                    {liveSnapshot.preparingOrders}
                  </span>
                  <span className="text-xs text-zinc-500 font-medium">Sipariş</span>
                </div>
              </div>

              <div className="p-4 rounded-3xl bg-[#0f1422] border border-zinc-800">
                <span className="text-zinc-400 text-xs block mb-1">Dolu Masa</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-amber-400">
                    {liveSnapshot.occupiedTables}
                  </span>
                  <span className="text-xs text-zinc-500 font-medium">
                    / {liveSnapshot.totalTables}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-3xl bg-[#0f1422] border border-zinc-800">
                <span className="text-zinc-400 text-xs block mb-1">Bugün Tamamlanan</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
                    {liveSnapshot.todayCompletedOrders}
                  </span>
                  <span className="text-xs text-zinc-500 font-medium">
                    %{liveSnapshot.occupancyRate} doluluk
                  </span>
                </div>
              </div>
            </div>
          )}

          {loadingKds ? (
            <div className="p-16 text-center text-zinc-500">Master KDS yükleniyor...</div>
          ) : kdsOrders.length === 0 ? (
            <div className="p-16 rounded-3xl bg-[#0f1422] border border-zinc-800 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-60" />
              <h3 className="text-base font-bold text-white">Tüm Alakart Mutfakları Sakin</h3>
              <p className="text-xs text-zinc-500 mt-1">
                Şu anda seçilen alakart restoranda bekleyen veya hazırlanan sipariş bulunmamaktadır.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {kdsOrders.map((order) => {
                const diffMs = new Date().getTime() - new Date(order.createdAt).getTime();
                const elapsedMins = Math.floor(diffMs / 60000);
                const isUrgent = elapsedMins >= 15;
                const isPreparing = order.status === "PREPARING";

                return (
                  <div
                    key={order.id}
                    className={clsx(
                      "rounded-3xl border p-5 flex flex-col justify-between transition-all bg-[#0f1422]",
                      isUrgent
                        ? "border-rose-500/50 shadow-lg shadow-rose-500/10"
                        : isPreparing
                        ? "border-amber-500/40"
                        : "border-zinc-800"
                    )}
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-800/80 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              {order.restaurant?.name}
                            </span>
                            <span className="text-xs font-mono font-bold text-zinc-400">
                              #{order.orderNumber}
                            </span>
                          </div>
                          <h3 className="text-lg font-black text-white mt-1">
                            {order.table?.name}
                          </h3>
                          <span className="text-[11px] text-zinc-400">
                            Garson: <strong className="text-zinc-200">{order.waiter?.name}</strong>
                          </span>
                        </div>

                        {/* Elapsed Timer */}
                        <div
                          className={clsx(
                            "flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border",
                            isUrgent
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                              : "bg-zinc-800/80 text-zinc-300 border-zinc-700"
                          )}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{elapsedMins} dk</span>
                        </div>
                      </div>

                      {/* Notes */}
                      {order.notes && (
                        <div className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200">
                          <strong>Not:</strong> {order.notes}
                        </div>
                      )}

                      {/* Items */}
                      <div className="space-y-2 mb-4">
                        {order.items.map((item: any) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/60"
                          >
                            <div className="flex items-center gap-2.5">
                              {item.menuItem.imageUrl && (
                                <img
                                  src={item.menuItem.imageUrl}
                                  alt={item.menuItem.name}
                                  className="w-9 h-9 rounded-lg object-cover border border-zinc-800"
                                />
                              )}
                              <div>
                                <div className="text-xs font-bold text-white">
                                  {item.menuItem.name}
                                </div>
                                {item.itemNotes && (
                                  <span className="text-[10px] text-amber-300 block">
                                    ★ {item.itemNotes}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-sm font-black text-amber-400 px-2 py-0.5 rounded-lg bg-zinc-800">
                              {item.quantity}x
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handlePrint(order.id)}
                        className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs flex items-center gap-1.5"
                        title="Fiş Bas"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">80mm Fiş</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {order.status !== "COMPLETED" && order.status !== "CANCELLED" && (
                          <button
                            onClick={() => handleStatusChange(order.id, "CANCELLED")}
                            className="px-3.5 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/20"
                            title="Siparişi iptal et"
                          >
                            İptal Et
                          </button>
                        )}
                        <span
                          className="px-3.5 py-2 rounded-xl bg-zinc-800/80 text-zinc-500 text-[11px] font-bold border border-zinc-700/70"
                          title="Hazırlanıyor ve Tamamlandı işaretlemesi yalnızca mutfak ekranından yapılabilir."
                        >
                          🔒 Mutfak: Hazırlandı / Tamamlandı
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: SİPARİŞ GİRİŞİ (ŞEF) */}
      {/* Şef restoran seçer, masa + garson seçer, ürünleri sepete ekler ve */}
      {/* siparişi mutfağa iletir. Hazırlandı/Tamamlandı mutfağın işidir. */}
      {/* ======================================================== */}
      {activeTab === "orderEntry" && (
        <div className="space-y-4">
          {/* Uyari / basari mesaji */}
          {entryMessage && (
            <div
              className={clsx(
                "flex items-start gap-2.5 p-4 rounded-2xl border text-xs font-semibold",
                entryMessage.tip === "ok"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              )}
            >
              {entryMessage.tip === "ok" ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <span>{entryMessage.metin}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* ---------------- SOL: Secimler + Urunler ---------------- */}
            <div className="lg:col-span-8 space-y-4">
              {/* Restoran / Masa / Garson */}
              <div className="p-4 sm:p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-lg space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <Utensils className="w-3.5 h-3.5 text-amber-400" />
                  Sipariş Bilgileri
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block">
                    <span className="text-[11px] font-bold text-zinc-400 block mb-1">Restoran *</span>
                    <select
                      value={entryRestaurantId}
                      onChange={(e) => setEntryRestaurantId(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="">Restoran seçiniz...</option>
                      {restaurants.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-bold text-zinc-400 block mb-1">Masa *</span>
                    <select
                      value={entryTableId}
                      onChange={(e) => setEntryTableId(e.target.value)}
                      disabled={!entryRestaurantId}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-500 disabled:opacity-50"
                    >
                      <option value="">Masa seçiniz...</option>
                      {entryTables.map((t: any) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.status === "EMPTY" ? "Boş" : "Dolu"})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-bold text-zinc-400 block mb-1">
                      Garson (siparişi alan) *
                    </span>
                    <select
                      value={entryWaiterId}
                      onChange={(e) => setEntryWaiterId(e.target.value)}
                      disabled={!entryRestaurantId}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-500 disabled:opacity-50"
                    >
                      <option value="">Garson seçiniz...</option>
                      {entryWaiters.map((w: any) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {entryWaiters.length === 0 && entryRestaurantId && (
                  <p className="text-[11px] text-amber-400 font-semibold">
                    Bu restoran için aktif garson tanımı bulunamadı. Sistem Yöneticisi'nden garson
                    tanımı yapılmalıdır.
                  </p>
                )}
              </div>

              {/* Urun listesi */}
              <div className="p-4 sm:p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <ChefHat className="w-3.5 h-3.5 text-amber-400" />
                    Menü Ürünleri
                  </h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input
                      type="text"
                      value={entrySearch}
                      onChange={(e) => setEntrySearch(e.target.value)}
                      placeholder="Ürün ara..."
                      className="w-full sm:w-64 bg-zinc-900 border border-zinc-700 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {entryGorunenUrunler.length === 0 ? (
                  <div className="py-10 text-center">
                    <ChefHat className="w-10 h-10 text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-zinc-500">
                      {entryRestaurantId
                        ? "Bu restoran için aktif menü ürünü bulunamadı."
                        : "Önce bir restoran seçiniz."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
                    {entryGorunenUrunler.map((u: any) => (
                      <button
                        key={u.id}
                        onClick={() => entryEkle(u)}
                        className="text-left p-2.5 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-amber-500/60 hover:bg-zinc-800/70 transition-all"
                      >
                        {u.imageUrl && (
                          <img
                            src={u.imageUrl}
                            alt={u.name}
                            className="w-full h-16 object-cover rounded-xl mb-2 border border-zinc-800"
                          />
                        )}
                        <div className="text-[11px] font-bold text-white leading-tight line-clamp-2">
                          {u.name}
                        </div>
                        {u.allergens && (
                          <div className="text-[9px] text-amber-400/80 mt-1 line-clamp-1">
                            {u.allergens}
                          </div>
                        )}
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-black text-amber-400">
                          <Plus className="w-3 h-3" /> Sepete Ekle
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ---------------- SAG: Sepet ---------------- */}
            <div className="lg:col-span-4">
              <div className="p-4 sm:p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-lg sticky top-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-2 mb-4">
                  <ShoppingCart className="w-3.5 h-3.5 text-amber-400" />
                  Sipariş Sepeti
                  <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-400">
                    {entrySepetToplam} ürün
                  </span>
                </h3>

                {entryCart.length === 0 ? (
                  <div className="py-10 text-center">
                    <ShoppingCart className="w-10 h-10 text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-zinc-500">
                      Sepet boş. Soldaki listeden ürün ekleyin.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {entryCart.map((k) => (
                      <div
                        key={k.menuItemId}
                        className="p-2.5 rounded-2xl bg-zinc-900/70 border border-zinc-800"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-bold text-white leading-tight">
                              {k.name}
                            </div>
                          </div>
                          <button
                            onClick={() => entryKaldir(k.menuItemId)}
                            className="p-1 rounded-lg bg-zinc-800 hover:bg-rose-600/80 text-zinc-400 hover:text-white transition-colors"
                            title="Sepetten çıkar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        <input
                          type="text"
                          value={k.itemNotes}
                          onChange={(e) => entryNotDegistir(k.menuItemId, e.target.value)}
                          placeholder="Ürün notu (örn: Az pişmiş)"
                          className="mt-2 w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                        />

                        <div className="mt-2 flex items-center justify-between">
                          <button
                            onClick={() => entryAdetDegistir(k.menuItemId, -1)}
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-black text-white">
                            {k.quantity}
                          </span>
                          <button
                            onClick={() => entryAdetDegistir(k.menuItemId, 1)}
                            className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <label className="block mt-4">
                  <span className="text-[11px] font-bold text-zinc-400 block mb-1">
                    Sipariş Genel Notu
                  </span>
                  <textarea
                    value={entryNotes}
                    onChange={(e) => setEntryNotes(e.target.value)}
                    rows={2}
                    placeholder="Örn: Müşteri özel istek, şef notu..."
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-semibold text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                  />
                </label>

                <button
                  onClick={entrySiparisVer}
                  disabled={entrySubmitting || entryCart.length === 0}
                  className="mt-4 w-full px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-colors flex items-center justify-center gap-2"
                >
                  {entrySubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {entrySubmitting ? "Gönderiliyor..." : "Siparişi Mutfağa İlet"}
                </button>

                <p className="mt-2.5 text-[10px] text-zinc-500 leading-relaxed">
                  Sipariş gönderildikten sonra "Hazırlandı" ve "Tamamlandı" işaretlemesi yalnızca
                  mutfak ekranından yapılabilir.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: GARSON & ALAKART TAKİBİ */}
      {/* ======================================================== */}
      {activeTab === "waiters" && (
        <div className="space-y-6">
          {/* Üst İstatistik Kartları */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-lg">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                Toplam Garson
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-white">
                  {waiterData.waiters.length}
                </span>
                <span className="text-xs text-zinc-500 font-semibold">Personel</span>
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-emerald-950/20 border border-emerald-500/30 shadow-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                  Alakartta Görevde
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-emerald-300">
                  {waiterData.waiters.filter((w) => w.isActiveInRestaurant).length}
                </span>
                <span className="text-xs text-emerald-400/80 font-semibold">Aktif Garson</span>
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-lg">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                Beklemede / Boşta
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-zinc-300">
                  {waiterData.waiters.filter((w) => !w.isActiveInRestaurant).length}
                </span>
                <span className="text-xs text-zinc-500 font-semibold">Giriş Bekliyor</span>
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-amber-950/20 border border-amber-500/30 shadow-lg">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                Bugünkü Siparişler
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-amber-300">
                  {waiterData.waiters.reduce((acc, w) => acc + w.todayOrderCount, 0)}
                </span>
                <span className="text-xs text-amber-400/80 font-semibold">Adisyon</span>
              </div>
            </div>
          </div>

          {/* Arama ve Filtreleme */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Garson adı veya kullanıcı adı ile ara..."
                value={waiterSearchQuery}
                onChange={(e) => setWaiterSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
              <span>Canlı Takip:</span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Otomatik Yenileme (10 sn)
              </span>
            </div>
          </div>

          {/* Garson Canlı Durum Tablosu */}
          {loadingWaiters ? (
            <div className="p-16 text-center text-zinc-500">Garson oturum bilgileri yükleniyor...</div>
          ) : (
            <div className="p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl overflow-hidden">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    Garsonların Alakart Görev ve Giriş Durumları
                  </h3>
                  <span className="text-xs text-zinc-400">
                    Hangi garson hangi restorana ne zaman giriş yapmış ve şu anda nerede görevli canlı takip edin.
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400">
                      <th className="py-3 px-3">Garson</th>
                      <th className="py-3 px-3">Görevli Olduğu Alakart</th>
                      <th className="py-3 px-3">Sisteme Giriş Saati</th>
                      <th className="py-3 px-3">Alakarta Giriş Saati</th>
                      <th className="py-3 px-3">Bugünkü Sipariş</th>
                      <th className="py-3 px-3">Son İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {waiterData.waiters
                      .filter(
                        (w) =>
                          w.name.toLowerCase().includes(waiterSearchQuery.toLowerCase()) ||
                          w.username.toLowerCase().includes(waiterSearchQuery.toLowerCase())
                      )
                      .map((w) => (
                        <tr key={w.id} className="hover:bg-zinc-900/50 transition-colors">
                          {/* Garson Kimliği */}
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-xs">
                                {w.name.charAt(0)}
                              </div>
                              <div>
                                <span className="font-bold text-white block text-sm">{w.name}</span>
                                <span className="text-[11px] font-mono text-zinc-400">@{w.username}</span>
                              </div>
                            </div>
                          </td>

                          {/* Görevli Olduğu Alakart */}
                          <td className="py-3.5 px-3">
                            {w.isActiveInRestaurant && w.activeRestaurant ? (
                              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold shadow-sm">
                                <Utensils className="w-3.5 h-3.5 text-amber-400" />
                                <span className="text-xs sm:text-sm">{w.activeRestaurant.name}</span>
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" title="Aktif Görevde" />
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-zinc-800 text-zinc-400 text-xs font-semibold">
                                <span className="w-2 h-2 rounded-full bg-zinc-600" />
                                Boşta / Giriş Bekliyor
                              </span>
                            )}
                          </td>

                          {/* Sisteme Giriş Saati */}
                          <td className="py-3.5 px-3">
                            {w.systemLoginTime ? (
                              <div>
                                <span className="font-mono font-bold text-white text-xs block">
                                  {new Date(w.systemLoginTime).toLocaleTimeString("tr-TR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  })}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-mono">
                                  {new Date(w.systemLoginTime).toLocaleDateString("tr-TR")}
                                </span>
                              </div>
                            ) : (
                              <span className="text-zinc-600 italic">Giriş Yok</span>
                            )}
                          </td>

                          {/* Alakarta Giriş Saati */}
                          <td className="py-3.5 px-3">
                            {w.restaurantEntryTime ? (
                              <div>
                                <span className="font-mono font-bold text-amber-400 text-xs block">
                                  {new Date(w.restaurantEntryTime).toLocaleTimeString("tr-TR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  })}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-mono">
                                  {new Date(w.restaurantEntryTime).toLocaleDateString("tr-TR")}
                                </span>
                              </div>
                            ) : (
                              <span className="text-zinc-600">-</span>
                            )}
                          </td>

                          {/* Sipariş Sayısı */}
                          <td className="py-3.5 px-3 font-semibold text-zinc-200">
                            <span className="px-2.5 py-1 rounded-xl bg-zinc-800 text-xs font-bold text-amber-300">
                              {w.todayOrderCount} Sipariş
                            </span>
                          </td>

                          {/* Son Hareket */}
                          <td className="py-3.5 px-3">
                            <div>
                              <span
                                className={clsx(
                                  "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                                  w.lastAction === "SELECT_RESTAURANT"
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                    : w.lastAction === "SWITCH_RESTAURANT"
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                    : w.lastAction === "LOGIN"
                                    ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                    : "bg-zinc-800 text-zinc-400 border-zinc-700"
                                )}
                              >
                                {w.lastAction === "SELECT_RESTAURANT"
                                  ? "Alakarta Giriş Yaptı"
                                  : w.lastAction === "SWITCH_RESTAURANT"
                                  ? "Restoran Değiştirdi"
                                  : w.lastAction === "LOGIN"
                                  ? "Sisteme Giriş"
                                  : w.lastAction === "LOGOUT"
                                  ? "Çıkış Yaptı"
                                  : w.lastAction}
                              </span>
                              {w.lastActionTime && (
                                <span className="block text-[10px] text-zinc-500 font-mono mt-0.5">
                                  {new Date(w.lastActionTime).toLocaleTimeString("tr-TR")}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Garson Giriş & Hareket Geçmişi (Canlı Log Akışı) */}
          <div className="p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl space-y-3">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Garson Giriş ve Restoran Değişim Geçmişi
              </h4>
              <span className="text-xs text-zinc-500">
                Garsonların sisteme giriş yaptığı ve alakart değiştirdiği zamanların kronolojik kaydı
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="py-2 px-3">Tarih & Saat</th>
                    <th className="py-2 px-3">Garson</th>
                    <th className="py-2 px-3">İşlem</th>
                    <th className="py-2 px-3">Alakart Restoran</th>
                    <th className="py-2 px-3">Açıklama</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {waiterData.history.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-zinc-500">
                        Henüz kaydedilmiş garson giriş/seçim hareketi bulunmuyor.
                      </td>
                    </tr>
                  ) : (
                    waiterData.history.map((h) => (
                      <tr key={h.id} className="hover:bg-zinc-900/40">
                        <td className="py-2.5 px-3 font-mono text-zinc-400 whitespace-nowrap">
                          {new Date(h.createdAt).toLocaleString("tr-TR")}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-white">{h.waiterName}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={clsx(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                              h.action === "SELECT_RESTAURANT"
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                : h.action === "SWITCH_RESTAURANT"
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                : h.action === "LOGIN"
                                ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                            )}
                          >
                            {h.action === "SELECT_RESTAURANT"
                              ? "Alakarta Giriş"
                              : h.action === "SWITCH_RESTAURANT"
                              ? "Restoran Değişimi"
                              : h.action === "LOGIN"
                              ? "Sisteme Giriş"
                              : "Çıkış"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-amber-300">
                          {h.restaurantName}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-300">{h.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: TARİH ARALIKLI RAPORLAMA & SÜRE ANALİTİĞİ */}
      {/* ======================================================== */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-zinc-400">Başlangıç:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-400">Bitiş:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                onClick={loadReport}
                className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Raporu Getir</span>
              </button>
            </div>

            {/* Export Actions */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel'e Aktar (.xlsx)</span>
              </button>

              <button
                onClick={handlePrintReport}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs border border-zinc-700 transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Yazdır / PDF</span>
              </button>
            </div>
          </div>

          {loadingReport ? (
            <div className="p-16 text-center text-zinc-500">Rapor ve analitik hesaplanıyor...</div>
          ) : reportData ? (
            <>
              {/* Summary KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl">
                  <span className="text-xs text-zinc-400 font-medium">Toplam Servis / Sipariş</span>
                  <div className="text-3xl font-black text-white mt-1">
                    {reportData.totalOrders} Adet
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Belirtilen tarih aralığında
                  </span>
                </div>

                <div className="p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl">
                  <span className="text-xs text-zinc-400 font-medium">Tamamlanan Siparişler</span>
                  <div className="text-3xl font-black text-emerald-400 mt-1">
                    {reportData.completedOrders} Adet
                  </div>
                  <span className="text-[10px] text-emerald-500/80 mt-1 block">
                    Başarıyla masaya servis edildi
                  </span>
                </div>

                <div className="p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl">
                  <span className="text-xs text-zinc-400 font-medium">
                    Ortalama Mutfak Hazırlık Süresi
                  </span>
                  <div className="text-3xl font-black text-amber-400 mt-1">
                    {reportData.avgPrepMinutes !== null ? `~${reportData.avgPrepMinutes} dk` : "-"}
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Garson siparişinden mutfak çıkışına
                  </span>
                </div>

                <div className="p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl">
                  <span className="text-xs text-zinc-400 font-medium">Aktif Bekleyen Sipariş</span>
                  <div className="text-3xl font-black text-cyan-400 mt-1">
                    {reportData.activeOrders} Adet
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-1 block">Şu an mutfakta işlemde</span>
                </div>
              </div>

              {/* Grid: Top Dishes & Waiter Performance */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* En Çok Tercih Edilen Lezzetler */}
                <div className="p-6 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <Utensils className="w-4 h-4 text-amber-400" />
                      En Çok Tercih Edilen Lezzetler
                    </h3>
                    <span className="text-xs text-zinc-500">Top 15</span>
                  </div>

                  <div className="space-y-2">
                    {reportData.topDishes.map((dish: any, idx: number) => (
                      <div
                        key={dish.name}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-mono font-bold text-amber-400">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="text-xs font-bold text-white">{dish.name}</div>
                            <span className="text-[10px] text-zinc-400">{dish.category}</span>
                          </div>
                        </div>
                        <span className="text-xs font-black text-white px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20">
                          {dish.count} Porsiyon
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Garson Sipariş Performansı */}
                <div className="p-6 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      Garson Sipariş Hacimleri
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {reportData.waiterStats.map((w: any) => (
                      <div
                        key={w.name}
                        className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/80"
                      >
                        <span className="text-xs font-bold text-white">{w.name}</span>
                        <span className="text-xs font-black px-3 py-1 rounded-xl bg-zinc-800 text-emerald-400">
                          {w.count} Sipariş
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sipariş & Hazırlık Süresi Detay Tablosu */}
              <div className="p-6 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
                  <div>
                    <h3 className="text-sm font-black text-white">
                      Detaylı Sipariş & Hazırlık Süresi Dökümü
                    </h3>
                    <span className="text-xs text-zinc-500">
                      Tüm aşamalar: Sipariş, Hazırlanma, Fiş ve Tamamlanma Zamanları
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400">
                        <th className="py-2.5 px-3">Sipariş</th>
                        <th className="py-2.5 px-3">Restoran</th>
                        <th className="py-2.5 px-3">Masa</th>
                        <th className="py-2.5 px-3">Garson</th>
                        <th className="py-2.5 px-3">Sipariş Saati</th>
                        <th className="py-2.5 px-3">Mutfak Başlama</th>
                        <th className="py-2.5 px-3">Tamamlanma</th>
                        <th className="py-2.5 px-3">Süre</th>
                        <th className="py-2.5 px-3">Durum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {reportData.orders.map((o: any) => (
                        <tr key={o.id} className="hover:bg-zinc-900/40">
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                            #{o.orderNumber}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-white">
                            {o.restaurantName}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-zinc-200">{o.tableName}</td>
                          <td className="py-2.5 px-3 text-zinc-400">{o.waiterName}</td>
                          <td className="py-2.5 px-3 font-mono text-zinc-400">
                            {new Date(o.createdAt).toLocaleTimeString("tr-TR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-zinc-400">
                            {o.preparingStartedAt
                              ? new Date(o.preparingStartedAt).toLocaleTimeString("tr-TR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "-"}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-zinc-400">
                            {o.completedAt
                              ? new Date(o.completedAt).toLocaleTimeString("tr-TR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "-"}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                            {o.prepDurationMinutes !== null ? `${o.prepDurationMinutes} dk` : "-"}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={clsx(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                                o.status === "COMPLETED"
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                  : o.status === "PREPARING"
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                  : "bg-zinc-800 text-zinc-400 border-zinc-700"
                              )}
                            >
                              {o.status === "COMPLETED"
                                ? "Tamamlandı"
                                : o.status === "PREPARING"
                                ? "Hazırlanıyor"
                                : "Bekliyor"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: AUDIT LOGS (DENETİM İZLERİ) */}
      {/* ======================================================== */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-[#0f1422] border border-zinc-800">
            <div>
              <h3 className="text-sm font-bold text-white">Sistem İşlem & Denetim Logları</h3>
              <span className="text-xs text-zinc-500">
                Garson, Mutfak ve Yönetici hareketlerinin saniye saniye kayıtları
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-semibold">İşlem Türü:</span>
              <select
                value={selectedAuditAction}
                onChange={(e) => setSelectedAuditAction(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">Tüm Hareketler</option>
                <option value="LOGIN">Giriş Yapıldı (LOGIN)</option>
                <option value="ORDER_CREATED">Sipariş Oluşturuldu (ORDER_CREATED)</option>
                <option value="STATUS_PREPARING">Hazırlanmaya Başlandı (STATUS_PREPARING)</option>
                <option value="STATUS_COMPLETED">Tamamlandı (STATUS_COMPLETED)</option>
                <option value="ORDER_PRINTED">Fiş Basıldı (ORDER_PRINTED)</option>
                <option value="ORDER_UPDATED">Sipariş Güncellendi (ORDER_UPDATED)</option>
                <option value="MENU_CREATED">Menü Tanımlandı (MENU_CREATED)</option>
              </select>
            </div>

            {/* Denetim izi çıktıları */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportAuditExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
              <button
                onClick={handlePrintAudit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-[11px] border border-zinc-700 transition-all"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Yazdır / PDF</span>
              </button>
            </div>
          </div>

          {loadingAudit ? (
            <div className="p-16 text-center text-zinc-500">Denetim logları yükleniyor...</div>
          ) : auditLogs.length === 0 ? (
            <div className="p-16 rounded-3xl bg-[#0f1422] border border-zinc-800 text-center text-zinc-500">
              Kayıtlı denetim izi bulunamadı.
            </div>
          ) : (
            <div className="p-4 rounded-3xl bg-[#0f1422] border border-zinc-800 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="py-2.5 px-3">Zaman</th>
                    <th className="py-2.5 px-3">Kullanıcı</th>
                    <th className="py-2.5 px-3">Rol</th>
                    <th className="py-2.5 px-3">İşlem</th>
                    <th className="py-2.5 px-3">Restoran</th>
                    <th className="py-2.5 px-3">Detay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-900/40">
                      <td className="py-2.5 px-3 font-mono text-zinc-400 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("tr-TR")}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-white">{log.userName}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={clsx(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                            log.userRole === "ADMIN"
                              ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                              : log.userRole === "CHEF"
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                              : log.userRole === "KITCHEN"
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                              : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                          )}
                        >
                          {log.userRole}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs font-semibold text-amber-300">
                        {log.action}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-400">
                        {log.restaurant?.name || "-"}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-300">{log.details || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      </div>

      <ChefAnalyticsPrintReport
        reportData={reportData}
        startDate={startDate}
        endDate={endDate}
        restaurantLabel={selectedRestaurantLabel}
        currentUser={currentUser}
      />

      <ChefAuditPrintReport
        auditLogs={auditLogs}
        restaurantLabel={selectedRestaurantLabel}
        currentUser={currentUser}
      />
    </>
  );
}
