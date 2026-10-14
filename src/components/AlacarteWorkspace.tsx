"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  SCREEN_CATALOG,
  type ScreenId,
} from "@/lib/types";
import { ServiceScreensView } from "@/components/screens/ServiceScreens";
import { ManagerScreensView } from "@/components/screens/ManagerScreens";
import { SysAdminScreensView } from "@/components/screens/SysAdminScreens";
import { WaiterPwaManager } from "@/components/WaiterPwaManager";
import { heartbeatAction, logoutAction } from "@/actions/pos";

export interface AlacarteWorkspaceProps {
  initialData: {
    actor: any;
    deploymentMode?: string;
    config: any;
    areas: any[];
    tables: any[];
    categories: any[];
    menuItems: any[];
    modifierGroups: any[];
    stations: any[];
    printerQueues: any[];
    users: any[];
    sessions: any[];
    cancelRequests: any[];
    printJobs: any[];
    auditLogs: any[];
    backups: any[];
    diagnosticRuns: any[];
    auditIntegrity: any;
  };
  initialScreen?: ScreenId;
}

export function AlacarteWorkspace({
  initialData,
  initialScreen = "SCR-03",
}: AlacarteWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [currentUser, setCurrentUser] = useState<any>(initialData.actor);
  const [activeScreen, setActiveScreen] = useState<ScreenId>(initialScreen);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(() => {
    const t8 = initialData.tables.find((t) => t.number === 8);
    return t8?.id || initialData.tables[0]?.id || null;
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [serverClock, setServerClock] = useState<string>("");
  const [toastState, setToastState] = useState<{
    message: string;
    tone: "teal" | "gold" | "red";
  } | null>(null);

  const notify = (message: string, tone: "teal" | "gold" | "red" = "teal") => {
    setToastState({ message, tone });
  };

  // Support PWA start_url & shortcuts (?pwa=1&mode=waiter&screen=SCR-04)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const screenParam = params.get("screen")?.toUpperCase() as ScreenId | undefined;

    if (
      screenParam &&
      SCREEN_CATALOG.some((s) => s.id === screenParam)
    ) {
      setActiveScreen(screenParam);
    }
  }, [initialData.users]);

  const selectedTable =
    initialData.tables.find((t) => t.id === selectedTableId) || null;

  const activeTableOpenSession = initialData.sessions.find(
    (s) => s.tableId === selectedTableId && s.status === "OPEN"
  );

  const draftItemCount = activeTableOpenSession
    ? (activeTableOpenSession.items || [])
        .filter((it: any) => it.status === "DRAFT" || it.status === "HELD")
        .reduce((acc: number, it: any) => acc + (it.quantity || 1), 0)
    : 0;

  useEffect(() => {
    if (!toastState) return;
    const t = setTimeout(() => setToastState(null), 3600);
    return () => clearTimeout(t);
  }, [toastState]);

  const businessTz = initialData.config?.timezone || "Asia/Nicosia";

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setServerClock(
        now.toLocaleTimeString("tr-TR", {
          timeZone: businessTz,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [businessTz]);


  // Periodic heartbeat every 25s
  useEffect(() => {
    if (!currentUser?.id) return;
    const hb = setInterval(async () => {
      try {
        const res = await heartbeatAction({
          userId: currentUser.id,
          deviceLabel:
            typeof window !== "undefined" && window.innerWidth < 1024
              ? "Garson Mobil El Terminali (WLAN)"
              : "Dokunmatik Sunucu-Kasa (Tiwox TP-8610)",
          clientMenuVersion: initialData.config?.menuVersion ?? 1,
        });
        if (res?.ok) {
          if (res.isMenuStale) {
            startTransition(() => {
              router.refresh();
            });
          }
        }
      } catch {
        // Offline / unreachable warning handled gracefully
      }
    }, 25000);
    return () => clearInterval(hb);
  }, [currentUser?.id, businessTz, initialData.config?.menuVersion]);

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const canAccessScreen = (screenId: ScreenId, role = currentUser?.role) => {
    const def = SCREEN_CATALOG.find((s) => s.id === screenId);
    if (!def) return false;
    return def.allowedRoles.includes(role);
  };

  const handleNavigate = (targetScreen: ScreenId) => {
    const normalized = targetScreen.toUpperCase() as ScreenId;
    const found =
      SCREEN_CATALOG.find((s) => s.id === normalized) ||
      SCREEN_CATALOG.find((s) => s.shortCode.toLowerCase() === targetScreen.toLowerCase());

    const resolvedId = found?.id ?? "SCR-03";
    if (!canAccessScreen(resolvedId)) {
      notify(
        `Yetki Reddedildi: Aktif rolünüz (${currentUser?.role}) ${resolvedId} (${found?.title}) ekranına erişemez.`,
        "red"
      );
      return;
    }
    setActiveScreen(resolvedId);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLogout = async () => {
    await logoutAction({ userId: currentUser?.id });
    router.replace("/login");
    router.refresh();
  };

  const visibleScreens = SCREEN_CATALOG.filter(
    (s) => s.id !== "SCR-01" && s.id !== "SCR-11" && canAccessScreen(s.id)
  );
  const groups = Array.from(new Set(visibleScreens.map((s) => s.group)));

  useEffect(() => {
    if (visibleScreens.length > 0 && !visibleScreens.some((s) => s.id === activeScreen)) {
      setActiveScreen(visibleScreens[0].id);
    }
  }, [visibleScreens, activeScreen]);

  const activeScreenDef =
    visibleScreens.find((s) => s.id === activeScreen) ?? visibleScreens[0] ?? SCREEN_CATALOG[2];

  const roleBadgeLabel =
    currentUser?.role === "SYSTEM_ADMIN"
      ? "Yerel Sistem Yöneticisi"
      : currentUser?.role === "RESTAURANT_MANAGER"
      ? "Restoran Yöneticisi"
      : "Garson";

  return (
    <div className="min-h-dvh grid grid-cols-1 lg:grid-cols-[272px_minmax(0,1fr)] bg-[#101819] text-[#f0f5f3]">
      {/* SIDEBAR: 19-Screen Catalog */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-dvh w-[272px] bg-[#131f20] border-r border-[#344647] p-4 flex flex-col gap-3.5 overflow-y-auto transition-transform duration-200 no-print ${
          mobileNavOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
        }`}
        aria-label="Alacarte Ekran Kataloğu"
      >
        <div className="flex items-center justify-between gap-2.5 px-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#91ead8] to-[#4bad9b] text-[#10201e] font-black text-lg grid place-items-center shadow-md">
              A
            </div>
            <div>
              <div className="font-extrabold tracking-widest text-xs text-[#f0f5f3]">
                ALACARTE
              </div>
              <div className="text-[11px] text-[#9aaead]">
                Restoran POS Sistemi
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="lg:hidden px-2 py-1 rounded border border-[#344647] text-xs text-[#9aaead]"
          >
            ✕
          </button>
        </div>

        <div className="border border-[#344647] bg-[#172323] rounded-xl p-2.5">
          <div className="text-[10px] font-bold tracking-widest text-[#9aaead] uppercase">
            RESTORAN
          </div>
          <div className="font-bold text-xs text-[#f0f5f3] mt-1 truncate">
            {initialData.config?.name || "Merit Garden · A La Carte"}
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[11px] text-[#73d8c6]">
            <span>{initialData.tables.length} Masa</span>
            <span>{initialData.areas?.length || 0} Alan</span>
          </div>
        </div>

        {/* Navigation Groups - Only authorized screens */}
        <nav className="flex-1 flex flex-col gap-3">
          {groups.map((grp) => {
            const grpScreens = visibleScreens.filter((s) => s.group === grp);
            if (grpScreens.length === 0) return null;
            return (
              <div key={grp} className="flex flex-col gap-1">
                <div className="px-2 text-[10px] font-extrabold tracking-widest text-[#718584] uppercase">
                  {grp}
                </div>
                {grpScreens.map((scr) => {
                  const isActive = scr.id === activeScreen;
                  return (
                    <button
                      key={scr.id}
                      type="button"
                      onClick={() => handleNavigate(scr.id)}
                      title={`${scr.id}: ${scr.description}`}
                      className={`w-full flex items-center gap-2.5 text-left px-2.5 py-2 rounded-lg text-xs transition ${
                        isActive
                          ? "bg-[#244440] border border-[#386e65] text-[#f4fffc] font-semibold"
                          : "border border-transparent text-[#b9c6c4] hover:bg-[#1d2b2c]"
                      }`}
                    >
                      <span
                        className={`w-6 h-5 rounded text-[10px] font-extrabold grid place-items-center shrink-0 ${
                          isActive
                            ? "bg-[#73d8c6] text-[#15221f]"
                            : "bg-[#283838] text-[#9aadaa]"
                        }`}
                      >
                        {scr.number}
                      </span>
                      <span className="flex-1 truncate">{scr.title}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Bottom User Identity Card */}
        <div className="mt-auto flex flex-col gap-2 pt-2 border-t border-[#344647]">
          <div className="flex items-center gap-2.5 px-1 py-1">
            <div className="w-8 h-8 rounded-full bg-[#394f50] text-[#c4f1e8] font-extrabold text-xs grid place-items-center shrink-0">
              {currentUser?.name
                ?.split(" ")
                .map((p: string) => p[0])
                .join("")
                .slice(0, 2) || "AK"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-xs truncate">{currentUser?.name}</div>
              <div className="text-[11px] text-[#9aaead] truncate">
                {roleBadgeLabel}
                {currentUser?.canApproveCancel && currentUser?.role === "WAITER"
                  ? " · Vardiya İptal Yetkilisi"
                  : ""}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE */}
      <div className="min-w-0 flex flex-col min-h-dvh">
        {/* TOPBAR */}
        <header className="sticky top-0 z-30 min-h-16 py-2 border-b border-[#344647] bg-[#131d1e]/95 backdrop-blur px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-2.5 no-print">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              className="lg:hidden px-2.5 py-1.5 rounded-lg border border-[#344647] bg-[#202f30] text-sm shrink-0"
              aria-label="Ekran Kataloğunu Aç"
            >
              ☰
            </button>
            <div className="min-w-0 flex items-center gap-3">
              <div className="flex flex-col min-w-0">
                <h1 className="font-black text-sm sm:text-base tracking-wider text-[#f0f5f3] uppercase truncate">
                  {initialData.config?.name || "Merit Garden · A La Carte"}
                </h1>
                <span className="text-[11px] text-[#73d8c6] font-medium truncate">
                  {activeScreenDef.title}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 justify-end flex-wrap sm:flex-nowrap">
            {/* Yanıp Sönen Demo Rozeti */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-950/90 border border-red-500/80 text-red-200 text-xs font-black tracking-wider uppercase demo-blinking-badge shrink-0 shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping inline-block" />
              <span>DEMO MODU</span>
            </div>

            {/* Learning Mode status indicator */}
            {initialData.config?.learningModeEnabled && (
              <span
                onClick={() => handleNavigate("SCR-04")}
                className="cursor-pointer hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-[#705e37] bg-[#393321] text-[#f1db9f] shrink-0"
                title="Restoran Yöneticisi tarafından Garson Öğrenme Modu etkinleştirildi"
              >
                🎓 Öğrenme Modu Açık
              </span>
            )}

            {/* Server Clock */}
            <div className="hidden 2xl:flex flex-col items-end text-xs text-[#9aaead] font-mono shrink-0">
              <span>
                Sunucu Saati: <b className="text-[#f0f5f3]">{serverClock || "19:42:00"}</b>
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="px-2.5 py-1.5 rounded-lg border border-red-900/60 bg-[#251b1b] hover:bg-[#332020] text-red-200 text-xs font-semibold shrink-0 whitespace-nowrap"
              title="Oturumu Kapat"
            >
              Çıkış
            </button>
          </div>
        </header>

        {/* WAITER MOBILE PWA MANAGER, WAKE LOCK & BOTTOM BAR */}
        <WaiterPwaManager
          activeScreen={activeScreen}
          currentUser={currentUser}
          selectedTable={selectedTable}
          draftItemCount={draftItemCount}
          onNavigate={handleNavigate}
          onRefresh={handleRefresh}
          notify={notify}
        />

        {/* CONTENT AREA */}
        <main className="flex-1 p-4 pb-24 lg:p-6 mx-auto w-full max-w-[1600px]">
          {["SCR-01", "SCR-02", "SCR-03", "SCR-04", "SCR-05", "SCR-06"].includes(
            activeScreen
          ) && (
            <ServiceScreensView
              activeScreen={
                activeScreen as
                  | "SCR-01"
                  | "SCR-02"
                  | "SCR-03"
                  | "SCR-04"
                  | "SCR-05"
                  | "SCR-06"
              }
              currentUser={currentUser}
              config={initialData.config}
              areas={initialData.areas}
              tables={initialData.tables}
              categories={initialData.categories}
              menuItems={initialData.menuItems}
              modifierGroups={initialData.modifierGroups}
              sessions={initialData.sessions}
              users={initialData.users}
              printerQueues={initialData.printerQueues}
              selectedTableId={selectedTableId}
              onSelectTable={(id) => setSelectedTableId(id)}
              onNavigate={handleNavigate}
              onSwitchUser={(user) => {
                setCurrentUser(user);
                notify(`Oturum açıldı: ${user.name} (${user.role})`, "teal");
              }}
              onRefresh={handleRefresh}
              notify={notify}
            />
          )}

          {["SCR-07", "SCR-08", "SCR-09", "SCR-10", "SCR-11", "SCR-12"].includes(
            activeScreen
          ) && (
            <ManagerScreensView
              activeScreen={
                activeScreen as
                  | "SCR-07"
                  | "SCR-08"
                  | "SCR-09"
                  | "SCR-10"
                  | "SCR-11"
                  | "SCR-12"
              }
              currentUser={currentUser}
              config={initialData.config}
              areas={initialData.areas}
              tables={initialData.tables}
              categories={initialData.categories}
              menuItems={initialData.menuItems}
              sessions={initialData.sessions}
              cancelRequests={initialData.cancelRequests}
              printJobs={initialData.printJobs}
              printerQueues={initialData.printerQueues}
              users={initialData.users}
              selectedTableId={selectedTableId}
              onSelectTable={(id) => setSelectedTableId(id)}
              onNavigate={handleNavigate}
              onRefresh={handleRefresh}
              notify={notify}
            />
          )}

          {[
            "SCR-13",
            "SCR-14",
            "SCR-15",
            "SCR-16",
            "SCR-17",
            "SCR-18",
            "SCR-19",
          ].includes(activeScreen) && (
            <SysAdminScreensView
              activeScreen={
                activeScreen as
                  | "SCR-13"
                  | "SCR-14"
                  | "SCR-15"
                  | "SCR-16"
                  | "SCR-17"
                  | "SCR-18"
                  | "SCR-19"
              }
              currentUser={currentUser}
              config={initialData.config}
              areas={initialData.areas}
              tables={initialData.tables}
              categories={initialData.categories}
              menuItems={initialData.menuItems}
              modifierGroups={initialData.modifierGroups}
              stations={initialData.stations}
              printerQueues={initialData.printerQueues}
              users={initialData.users}
              auditLogs={initialData.auditLogs}
              backups={initialData.backups}
              diagnosticRuns={initialData.diagnosticRuns}
              onNavigate={handleNavigate}
              onRefresh={handleRefresh}
              notify={notify}
            />
          )}
        </main>
      </div>

      {/* TOAST NOTIFICATION */}
      {toastState && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-5 bottom-20 lg:bottom-5 z-50 max-w-md px-4 py-3 rounded-xl border shadow-2xl text-xs font-semibold flex items-center gap-2.5 no-print ${
            toastState.tone === "red"
              ? "bg-[#3d2929] border-[#744947] text-[#ffc4bc]"
              : toastState.tone === "gold"
              ? "bg-[#393321] border-[#705e37] text-[#f1db9f]"
              : "bg-[#193b35] border-[#4b9e8d] text-[#d3fff5]"
          }`}
        >
          <span>
            {toastState.tone === "red"
              ? "⛔"
              : toastState.tone === "gold"
              ? "⚠️"
              : "✓"}
          </span>
          <span className="flex-1">{toastState.message}</span>
          <button
            type="button"
            onClick={() => setToastState(null)}
            className="opacity-75 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
