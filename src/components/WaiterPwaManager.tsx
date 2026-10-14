"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { ScreenId } from "@/lib/types";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface WaiterPwaManagerProps {
  activeScreen: ScreenId;
  currentUser: any;
  selectedTable: any | null;
  draftItemCount: number;
  phonePreviewMode: boolean;
  onTogglePhonePreview: () => void;
  onNavigate: (screen: ScreenId) => void;
  onRefresh: () => void;
  notify: (msg: string, tone?: "teal" | "gold" | "red") => void;
}

export function WaiterPwaManager({
  activeScreen,
  currentUser,
  selectedTable,
  draftItemCount,
  phonePreviewMode,
  onTogglePhonePreview,
  onNavigate,
  onRefresh,
  notify,
}: WaiterPwaManagerProps) {
  const [swStatus, setSwStatus] = useState<
    "REGISTERING" | "ACTIVE" | "UNSUPPORTED" | "ERROR"
  >("REGISTERING");
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installBannerDismissed, setInstallBannerDismissed] = useState(false);
  const [pwaDrawerOpen, setPwaDrawerOpen] = useState(false);

  // Screen Wake Lock state (prevents waiter phone from locking while taking orders at table)
  const [wakeLockSupported, setWakeLockSupported] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockSentinel, setWakeLockSentinel] = useState<any>(null);

  // Haptic feedback preference
  const [hapticEnabled, setHapticEnabled] = useState(true);

  // Closed-LAN connectivity & latency to Tiwox TP-8610 Server
  const [isOnline, setIsOnline] = useState(true);
  const [lanLatencyMs, setLanLatencyMs] = useState<number | null>(4);
  const [lastHealthCheck, setLastHealthCheck] = useState<string>("Şimdi");
  const [lanOrigin, setLanOrigin] = useState<string>("http://192.168.1.10:3000");

  // 1. Register Service Worker & detect standalone / iOS
  useEffect(() => {
    if (typeof window === "undefined") return;

    setLanOrigin(window.location.origin);

    const standaloneMatch =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      window.location.search.includes("pwa=1");
    setIsStandalone(standaloneMatch);

    const iosMatch =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iosMatch);

    setWakeLockSupported("wakeLock" in navigator);
    setIsOnline(navigator.onLine);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        })
        .then(() => {
          setSwStatus("ACTIVE");
        })
        .catch(() => {
          setSwStatus("ERROR");
        });
    } else {
      setSwStatus("UNSUPPORTED");
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      notify(
        "Alacarte Garson Mobil PWA ana ekranınıza başarıyla kuruldu!",
        "teal"
      );
    };

    const handleOnline = () => {
      setIsOnline(true);
      notify(
        "Restoran Kapalı LAN (Archer AX23 Wi-Fi) bağlantısı yeniden sağlandı.",
        "teal"
      );
    };

    const handleOffline = () => {
      setIsOnline(false);
      notify(
        "Uyarı: Restoran Wi-Fi bağlantısı kesildi! Sipariş göndermek için yerel ağ menziline dönün.",
        "red"
      );
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [notify]);

  // 2. Measure Closed-LAN latency via /api/health
  const checkLanHealth = useCallback(async () => {
    if (typeof window === "undefined") return;
    const t0 = performance.now();
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (res.ok) {
        const dt = Math.max(1, Math.round(performance.now() - t0));
        setLanLatencyMs(dt);
        setIsOnline(true);
        setLastHealthCheck(
          new Date().toLocaleTimeString("tr-TR", {
            timeZone: "Asia/Nicosia",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );
      } else {
        setIsOnline(false);
      }
    } catch {
      setIsOnline(false);
    }
  }, []);

  useEffect(() => {
    checkLanHealth();
    const timer = setInterval(checkLanHealth, 20000);
    return () => clearInterval(timer);
  }, [checkLanHealth]);

  // 3. Screen Wake Lock toggle (keep waiter screen awake during table service)
  const toggleWakeLock = useCallback(async () => {
    if (typeof window === "undefined" || !("wakeLock" in navigator)) {
      notify(
        "Bu tarayıcıda Screen Wake Lock API desteklenmiyor; cihaz ekran süresini ayarlardan uzatabilirsiniz.",
        "gold"
      );
      return;
    }

    try {
      if (wakeLockActive && wakeLockSentinel) {
        await wakeLockSentinel.release();
        setWakeLockSentinel(null);
        setWakeLockActive(false);
        notify("Ekran uyanık tutma (Wake Lock) kapatıldı.", "gold");
      } else {
        const sentinel = await (navigator as any).wakeLock.request("screen");
        sentinel.addEventListener("release", () => {
          setWakeLockActive(false);
        });
        setWakeLockSentinel(sentinel);
        setWakeLockActive(true);
        notify(
          "🔆 Masa başında sipariş alırken telefon ekranı kapanmayacak (Wake Lock Aktif).",
          "teal"
        );
      }
    } catch {
      notify(
        "Ekran kilidi engelleme etkinleştirilemedi (Pil tasarrufu açık olabilir).",
        "gold"
      );
    }
  }, [wakeLockActive, wakeLockSentinel, notify]);

  // Re-acquire Wake Lock when returning to foreground tab
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (
        document.visibilityState === "visible" &&
        wakeLockActive &&
        "wakeLock" in navigator
      ) {
        try {
          const sentinel = await (navigator as any).wakeLock.request("screen");
          setWakeLockSentinel(sentinel);
        } catch {
          // Ignore
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [wakeLockActive]);

  const triggerHaptic = () => {
    if (
      hapticEnabled &&
      typeof navigator !== "undefined" &&
      "vibrate" in navigator
    ) {
      try {
        navigator.vibrate(18);
      } catch {
        // Ignore on unsupported devices
      }
    }
  };

  const handleInstallClick = async () => {
    triggerHaptic();
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
        setIsStandalone(true);
        notify("Alacarte Garson PWA kurulumu başlatıldı.", "teal");
      }
    } else {
      setPwaDrawerOpen(true);
    }
  };

  const sendTestWaiterNotification = async () => {
    triggerHaptic();
    if (typeof window === "undefined" || !("Notification" in window)) {
      notify("Bu cihaz tarayıcısı yerel bildirimleri desteklemiyor.", "gold");
      return;
    }

    let perm = Notification.permission;
    if (perm === "default") {
      perm = await Notification.requestPermission();
    }

    if (perm !== "granted") {
      notify(
        "Bildirim izni verilmedi. Tarayıcı adres çubuğundan bildirimlere izin verin.",
        "gold"
      );
      return;
    }

    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      reg.active?.postMessage({
        type: "SHOW_WAITER_NOTIFICATION",
        title: `ALACARTE · ${selectedTable?.name || "Masa 08"}`,
        body: `Garson ${currentUser?.name || "Personel"}: Kapalı LAN PWA bildirimi ve titreşim testi başarılı.`,
        url: "/?pwa=1&mode=waiter",
      });
      notify("Mobil PWA test bildirimi gönderildi.", "teal");
    }
  };

  const handleBottomNav = (screenId: ScreenId) => {
    triggerHaptic();
    onNavigate(screenId);
  };

  return (
    <>
      {/* 1. OFFLINE / LAN DISCONNECT BANNER */}
      {!isOnline && (
        <div
          role="alert"
          className="bg-[#482625] border-b border-[#8e4c49] px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-[#ffd2cc] no-print"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">📡</span>
            <span>
              <b>Kapalı LAN Wi-Fi Bağlantısı Kesildi:</b> Sunucu-Kasa (Tiwox
              TP-8610) ile iletişim kurulamıyor. Uygulama kabuğu PWA önbelleğinden
              çalışıyor; sipariş göndermek için <b>Archer AX23 Wi-Fi</b> kapsama
              alanına dönün.
            </span>
          </div>
          <button
            type="button"
            onClick={checkLanHealth}
            className="px-3 py-1.5 rounded-lg bg-[#f18d83] text-[#1f1110] font-bold shrink-0"
          >
            Yeniden Dene
          </button>
        </div>
      )}

      {/* 2. PWA INSTALL & WAKE LOCK COMPACT BAR FOR MOBILE / WAITER MODE */}
      {!installBannerDismissed && (!isStandalone || phonePreviewMode) && (
        <div className="bg-gradient-to-r from-[#17332f] via-[#1b3935] to-[#16292a] border-b border-[#34635c] px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#d6fbf2] no-print">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded-md bg-[#73d8c6] text-[#10221f] font-black text-[10px] tracking-wider uppercase shrink-0">
              MOBİL PWA
            </span>
            <span className="truncate font-medium">
              Garson El Terminali: Ana ekrana ekleyerek tam ekran (adres çubuksuz)
              ve ekran kapanmadan kullanın.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {wakeLockSupported && (
              <button
                type="button"
                onClick={toggleWakeLock}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition ${
                  wakeLockActive
                    ? "border-[#efc97b] bg-[#393321] text-[#f1db9f]"
                    : "border-[#386e65] bg-[#1e3d38] text-[#bdf0e4] hover:bg-[#264d47]"
                }`}
              >
                {wakeLockActive
                  ? "🔆 Ekran Uyanık: AÇIK"
                  : "🔆 Ekranı Uyanık Tut"}
              </button>
            )}
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-3 py-1 rounded-lg bg-[#73d8c6] hover:bg-[#8be7d6] text-[#10221f] font-extrabold text-[11px] shadow-sm"
            >
              {deferredPrompt ? "📲 Telefona Kur" : "📲 PWA Kurulum & Ayarlar"}
            </button>
            <button
              type="button"
              onClick={() => setInstallBannerDismissed(true)}
              className="text-[#9aaead] hover:text-white px-1.5 py-0.5 text-xs"
              aria-label="PWA Çubuğunu Gizle"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 3. FIXED MOBILE BOTTOM NAVIGATION BAR (Waiter Thumb Ergonomics) */}
      <nav
        aria-label="Garson Mobil Hızlı Gezinme Çubuğu"
        className={`${
          phonePreviewMode ? "flex" : "flex lg:hidden"
        } fixed bottom-0 left-0 right-0 z-40 bg-[#121d1e]/95 backdrop-blur-md border-t border-[#344647] px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] items-center justify-around gap-1 shadow-[0_-10px_30px_rgba(0,0,0,0.45)] no-print`}
      >
        <button
          type="button"
          onClick={() => handleBottomNav("SCR-03")}
          className={`flex-1 min-h-[52px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition ${
            activeScreen === "SCR-03"
              ? "bg-[#244440] text-[#73d8c6] border border-[#386e65]"
              : "text-[#9aaead] hover:text-[#f0f5f3]"
          }`}
        >
          <span className="text-base leading-none">🪑</span>
          <span>Masalar</span>
        </button>

        <button
          type="button"
          onClick={() => handleBottomNav("SCR-04")}
          className={`relative flex-1 min-h-[52px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition ${
            activeScreen === "SCR-04"
              ? "bg-[#244440] text-[#73d8c6] border border-[#386e65]"
              : "text-[#9aaead] hover:text-[#f0f5f3]"
          }`}
        >
          <span className="text-base leading-none">🍽️</span>
          <span>
            {selectedTable ? `M-${String(selectedTable.number).padStart(2, "0")}` : "Sipariş"}
          </span>
          {draftItemCount > 0 && (
            <span className="absolute top-1 right-2 px-1.5 py-0.2 rounded-full bg-[#efc97b] text-[#15221f] font-black text-[10px]">
              {draftItemCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleBottomNav("SCR-05")}
          className={`flex-1 min-h-[52px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition ${
            activeScreen === "SCR-05"
              ? "bg-[#244440] text-[#73d8c6] border border-[#386e65]"
              : "text-[#9aaead] hover:text-[#f0f5f3]"
          }`}
        >
          <span className="text-base leading-none">⚙️</span>
          <span>Seçenek</span>
        </button>

        <button
          type="button"
          onClick={() => handleBottomNav("SCR-06")}
          className={`flex-1 min-h-[52px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition ${
            activeScreen === "SCR-06"
              ? "bg-[#244440] text-[#73d8c6] border border-[#386e65]"
              : "text-[#9aaead] hover:text-[#f0f5f3]"
          }`}
        >
          <span className="text-base leading-none">⏱️</span>
          <span>Zamanla</span>
        </button>

        <button
          type="button"
          onClick={() => handleBottomNav("SCR-09")}
          className={`flex-1 min-h-[52px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition ${
            activeScreen === "SCR-09"
              ? "bg-[#244440] text-[#73d8c6] border border-[#386e65]"
              : "text-[#9aaead] hover:text-[#f0f5f3]"
          }`}
        >
          <span className="text-base leading-none">⊘</span>
          <span>İptal</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            setPwaDrawerOpen(true);
          }}
          className={`relative flex-1 min-h-[52px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition ${
            pwaDrawerOpen
              ? "bg-[#244440] text-[#73d8c6] border border-[#386e65]"
              : "text-[#9aaead] hover:text-[#f0f5f3]"
          }`}
        >
          <span className="text-base leading-none">📲</span>
          <span>PWA</span>
          <span
            className={`absolute top-1.5 right-3 w-2 h-2 rounded-full ${
              isOnline ? "bg-[#73d8c6]" : "bg-[#f18d83]"
            }`}
          />
        </button>
      </nav>

      {/* 4. WAITER MOBILE PWA CONTROL & INSTALLATION DRAWER / MODAL */}
      {pwaDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 no-print"
          onClick={() => setPwaDrawerOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-[#162223] border border-[#344647] rounded-t-3xl sm:rounded-2xl p-5 text-[#f0f5f3] shadow-2xl max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#344647]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#91ead8] to-[#4bad9b] text-[#10201e] font-black text-xl grid place-items-center shadow">
                  A
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#f0f5f3]">
                    Garson Mobil El Terminali (PWA)
                  </h3>
                  <p className="text-xs text-[#9aaead]">
                    Kapalı Yerel Ağ (Archer AX23 Wi-Fi) · İnternetsiz Mobil POS
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPwaDrawerOpen(false)}
                className="px-2.5 py-1 rounded-lg border border-[#344647] bg-[#202f30] text-xs text-[#9aaead] hover:text-white"
              >
                ✕ Kapat
              </button>
            </div>

            {/* Status Grid */}
            <div className="grid grid-cols-2 gap-2.5 my-4">
              <div className="p-3 rounded-xl bg-[#1d2b2c] border border-[#344647]">
                <div className="text-[11px] text-[#9aaead]">PWA Çalışma Modu</div>
                <div className="font-bold text-xs mt-1 text-[#73d8c6]">
                  {isStandalone
                    ? "● Tam Ekran (Standalone PWA)"
                    : "○ Tarayıcı Sekmesi (Kurulabilir)"}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#1d2b2c] border border-[#344647]">
                <div className="text-[11px] text-[#9aaead]">Service Worker</div>
                <div className="font-bold text-xs mt-1 text-[#73d8c6]">
                  {swStatus === "ACTIVE"
                    ? "● Aktif (alacarte-lan-pwa-v3)"
                    : swStatus === "REGISTERING"
                    ? "⟳ Kaydediliyor..."
                    : "⚠ Desteklenmiyor"}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#1d2b2c] border border-[#344647]">
                <div className="text-[11px] text-[#9aaead]">
                  Kapalı LAN Sunucu Gecikmesi
                </div>
                <div className="font-bold text-xs mt-1 text-[#f0f5f3]">
                  {isOnline
                    ? `● ${lanLatencyMs ?? 3} ms (Son: ${lastHealthCheck})`
                    : "⛔ Bağlantı Yok"}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#1d2b2c] border border-[#344647]">
                <div className="text-[11px] text-[#9aaead]">
                  Aktif Garson & Masa
                </div>
                <div className="font-bold text-xs mt-1 text-[#efc97b] truncate">
                  {currentUser?.name} ·{" "}
                  {selectedTable ? selectedTable.name : "Masa Seçilmedi"}
                </div>
              </div>
            </div>

            {/* Mobile Ergonomics & Hardware Controls */}
            <div className="space-y-2.5 mb-4">
              <div className="p-3.5 rounded-xl bg-[#1d2b2c] border border-[#344647] flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-xs">
                    🔆 Masa Başında Ekranı Uyanık Tut (Wake Lock)
                  </div>
                  <div className="text-[11px] text-[#9aaead] mt-0.5">
                    Koltuk bazlı sipariş alırken telefon ekranının kararmasını
                    ve kilitlenmesini engeller.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleWakeLock}
                  className={`px-3 py-2 rounded-xl font-extrabold text-xs shrink-0 border transition ${
                    wakeLockActive
                      ? "bg-[#73d8c6] text-[#10201e] border-[#73d8c6]"
                      : "bg-[#263738] text-[#f0f5f3] border-[#344647]"
                  }`}
                >
                  {wakeLockActive ? "AÇIK" : "KAPALI"}
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-[#1d2b2c] border border-[#344647] flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-xs">
                    📳 Dokunmatik Titreşim (Haptic Feedback)
                  </div>
                  <div className="text-[11px] text-[#9aaead] mt-0.5">
                    Ürün ekleme ve alt bar geçişlerinde mikro titreşim verir.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !hapticEnabled;
                    setHapticEnabled(next);
                    if (next && "vibrate" in navigator) navigator.vibrate(25);
                  }}
                  className={`px-3 py-2 rounded-xl font-extrabold text-xs shrink-0 border transition ${
                    hapticEnabled
                      ? "bg-[#73d8c6] text-[#10201e] border-[#73d8c6]"
                      : "bg-[#263738] text-[#f0f5f3] border-[#344647]"
                  }`}
                >
                  {hapticEnabled ? "AÇIK" : "KAPALI"}
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-[#1d2b2c] border border-[#344647] flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-xs">
                    📱 Garson El Terminali Görünüm Simülatörü (390px)
                  </div>
                  <div className="text-[11px] text-[#9aaead] mt-0.5">
                    Kasa ekranında garson mobil PWA arayüzünü test edin.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onTogglePhonePreview}
                  className={`px-3 py-2 rounded-xl font-extrabold text-xs shrink-0 border transition ${
                    phonePreviewMode
                      ? "bg-[#73d8c6] text-[#10201e] border-[#73d8c6]"
                      : "bg-[#263738] text-[#f0f5f3] border-[#344647]"
                  }`}
                >
                  {phonePreviewMode ? "MOBİL AKTİF" : "TAM EKRAN"}
                </button>
              </div>
            </div>

            {/* Installation Instructions for Android & iOS */}
            <div className="p-3.5 rounded-xl bg-[#183630] border border-[#2d6a5e] text-[#d5faf1] text-xs space-y-2 mb-4">
              <div className="font-extrabold text-sm flex items-center justify-between">
                <span>📲 Garson Telefonuna Kurulum Adımları</span>
                <span className="font-mono text-[11px] bg-[#102420] px-2 py-0.5 rounded">
                  {lanOrigin}/?pwa=1&mode=waiter
                </span>
              </div>
              {deferredPrompt ? (
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="w-full py-2.5 rounded-xl bg-[#73d8c6] text-[#10201e] font-black text-xs shadow"
                >
                  ＋ Şimdi Ana Ekrana Yükle (Tek Dokunuş PWA)
                </button>
              ) : (
                <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed text-[#bcebe1]">
                  <li>
                    <b>Android (Chrome / Edge):</b> Sağ üstteki <b>⋮</b> menüsünden{" "}
                    <b>&quot;Uygulamayı yükle&quot;</b> veya{" "}
                    <b>&quot;Ana ekrana ekle&quot;</b> seçeneğine dokunun.
                  </li>
                  <li>
                    <b>iPhone / iOS (Safari):</b> Alt bardaki <b>Paylaş (⎋)</b>{" "}
                    simgesine dokunun ve{" "}
                    <b>&quot;Ana Ekrana Ekle (➕)&quot;</b> seçeneğini onaylayın.
                    {isIOS && " (iOS cihaz algılandı)"}
                  </li>
                  <li>
                    <b>Kapalı LAN Notu:</b> Garson telefonları yalnız restoranın{" "}
                    <b>TP-Link Archer AX23</b> Wi-Fi ağına bağlanır; internet
                    paketi gerekmez.
                  </li>
                </ul>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={sendTestWaiterNotification}
                className="px-3.5 py-2 rounded-xl border border-[#386e65] bg-[#213e3a] hover:bg-[#294d48] text-xs font-bold text-[#bdf0e4]"
              >
                🔔 Bildirim & Titreşim Testi
              </button>
              <button
                type="button"
                onClick={() => {
                  checkLanHealth();
                  onRefresh();
                  notify("Sunucu-Kasa ile menü ve masa durumu eşitlendi.", "teal");
                }}
                className="px-3.5 py-2 rounded-xl bg-[#73d8c6] hover:bg-[#8be7d6] text-[#10201e] text-xs font-black"
              >
                ↻ Sunucu ile Şimdi Eşitle
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
