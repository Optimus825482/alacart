"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  loginAction,
  openOrResumeTableAction,
  updateGuestAndSeatCountAction,
  addDraftItemAction,
  updateDraftItemAction,
  removeDraftItemAction,
  holdOrScheduleAction,
  sendRoundToKitchenAction,
  evaluateScheduledItemsAction,
  toggleMenuItem86Action,
  transferTableAction,
  mergeTablesAction,
  toggleRoundRushAction,
  toggleItemRushAction,
  reorderRoundAction,
  transferSessionWaiterAction,
  reprintKitchenChitAction,
} from "@/actions/pos";
import { completeSetupWizardAction } from "@/actions/sysadmin";

export interface ServiceScreensProps {
  activeScreen: "SCR-01" | "SCR-02" | "SCR-03" | "SCR-04" | "SCR-05" | "SCR-06";
  currentUser: any;
  config: any;
  areas: any[];
  tables: any[];
  categories: any[];
  menuItems: any[];
  modifierGroups: any[];
  sessions: any[];
  users: any[];
  printerQueues: any[];
  selectedTableId: string | null;
  onSelectTable: (tableId: string) => void;
  onNavigate: (screen: any) => void;
  onSwitchUser: (user: any) => void;
  onRefresh: () => void;
  notify: (msg: string, tone?: "teal" | "gold" | "red") => void;
}

type StatusMeta = {
  label: string;
  icon: string;
  badgeClass: string;
  dotColor: string;
  tileBorder: string;
};

const TABLE_STATUS_META: Record<string, StatusMeta> = {
  EMPTY: {
    label: "Boş",
    icon: "○",
    badgeClass: "border-[#465353] bg-[#2d3939] text-[#bbc8c6]",
    dotColor: "#697a78",
    tileBorder: "border-[#344647] bg-[#192526]",
  },
  IN_SERVICE: {
    label: "Serviste",
    icon: "●",
    badgeClass: "border-[#3c6058] bg-[#243d39] text-[#bdf0e4]",
    dotColor: "#73d8c6",
    tileBorder: "border-[#386e65] bg-gradient-to-br from-[#233a38] to-[#192526]",
  },
  DRAFT_PENDING: {
    label: "Taslak Var",
    icon: "✎",
    badgeClass: "border-[#665637] bg-[#3b3325] text-[#f2d38f]",
    dotColor: "#efc97b",
    tileBorder: "border-[#705e37] bg-gradient-to-br from-[#352f21] to-[#192526]",
  },
  SCHEDULED_PENDING: {
    label: "Zamanlandı / Bekliyor",
    icon: "⏱",
    badgeClass: "border-[#4b6782] bg-[#233544] text-[#b4dcf7]",
    dotColor: "#8dc4e9",
    tileBorder: "border-[#4b6782] bg-gradient-to-br from-[#213240] to-[#192526]",
  },
  PRINT_PENDING: {
    label: "Baskı Kuyruğunda",
    icon: "⎙",
    badgeClass: "border-[#3c6058] bg-[#243d39] text-[#bdf0e4]",
    dotColor: "#73d8c6",
    tileBorder: "border-[#386e65] bg-[#1e2e2e]",
  },
  PRINT_WARNING: {
    label: "Baskı Uyarısı",
    icon: "⚠",
    badgeClass: "border-[#684442] bg-[#3e2c2b] text-[#ffc0b5]",
    dotColor: "#f18d83",
    tileBorder: "border-[#754541] bg-gradient-to-br from-[#3d2625] to-[#192526]",
  },
  CANCEL_PENDING: {
    label: "İptal Bekliyor",
    icon: "⊘",
    badgeClass: "border-[#684442] bg-[#3e2c2b] text-[#ffc0b5]",
    dotColor: "#f18d83",
    tileBorder: "border-[#754541] bg-gradient-to-br from-[#3b2827] to-[#192526]",
  },
};

const LEARNING_GUIDE_STEPS = [
  {
    step: 1,
    title: "Masa ve Sipariş Referansını Kontrol Edin",
    detail:
      "Sol adisyon bölmesinin üst kısmında seçili masanın numarasını, açık sipariş referans kodunu (A-2026-...) ve servisi açan garsonu doğrulayın.",
  },
  {
    step: 2,
    title: "Misafir (Kuver) ve Koltuk Sayısını Belirleyin",
    detail:
      "Üst kontrol şeridinden Misafir (−/+) sayısını girin ve ürün ekleyeceğiniz Koltuk numarasını (Koltuk 1..N) seçin. Gerekirse '+ Koltuk' ile yeni koltuk açın.",
  },
  {
    step: 3,
    title: "Ana Kategori ve Alt Kategoriden Ürün Seçin",
    detail:
      "Orta menü panosundan ana kategoriyi, alt şeritten alt kategoriyi seçin veya üstteki ürün arama kutusunu kullanın. Ürün kutusuna dokunarak taslak tura ekleyin.",
  },
  {
    step: 4,
    title: "Kalem Seçenekleri, Pişme Derecesi ve Paylaşım (SCR-05)",
    detail:
      "Eklediğiniz taslak kaleme dokunarak veya sağdaki 'KALEM SEÇENEKLERİ' düğmesiyle SCR-05'e geçin; zorunlu/isteğe bağlı modifier, mutfak notu ve koltuk paylaşımı ([1,2,3] adet çoğaltmadan) ayarlayın.",
  },
  {
    step: 5,
    title: "Bekletme veya Zamanlı Gönderim Planlayın (SCR-06)",
    detail:
      "Misafir bazı yemeklerin daha sonra hazırlanmasını isterse üstten 'Bu turdaki ürünleri beklet' anahtarını açın veya 'BEKLET / ZAMANLA' ekranından sunucu saatine göre zaman atayın.",
  },
  {
    step: 6,
    title: "Mutfağa Gönderin (Tekil İdempotent Gönderim)",
    detail:
      "Taslak kalemleri kontrol ettikten sonra sağ alttaki 'MUTFAĞA GÖNDER' düğmesine basın. Çift dokunuş koruması (idempotencyKey) sayesinde aynı tur mükerrer basılmaz.",
  },
  {
    step: 7,
    title: "Fiyatsız Adisyon ve İptal Kuralları",
    detail:
      "Mutfağa gönderilmiş kalemler doğrudan silinemez; gerekirse 'İPTAL TALEBİ (SCR-09)' açılır. Servis özeti için 'FİYATSIZ ADİSYON (SCR-11)' kullanılır; ekranda ve çıktıda fiyat/ödeme yer almaz.",
  },
];

function formatIstanbulTime(dateInput?: string | Date | null): string {
  if (!dateInput) return "—";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("tr-TR", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatIstanbulDateTime(dateInput?: string | Date | null): string {
  if (!dateInput) return "—";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("tr-TR", {
      timeZone: "Europe/Istanbul",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function defaultIstanbulDateTimeLocal(minutesAhead = 25): string {
  const target = new Date(Date.now() + minutesAhead * 60_000);
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(target)
    .replace(" ", "T");
  return parts.slice(0, 16);
}

function safeParseJsonArray<T = any>(raw?: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function ServiceScreensView(props: ServiceScreensProps) {
  const {
    activeScreen,
    currentUser,
    config,
    areas = [],
    tables = [],
    categories = [],
    menuItems = [],
    modifierGroups = [],
    sessions = [],
    users = [],
    printerQueues = [],
    selectedTableId,
    onSelectTable,
    onNavigate,
    onSwitchUser,
    onRefresh,
    notify,
  } = props;

  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Shared selection states across SCR-03..06
  const activeTable = useMemo(() => {
    if (selectedTableId) {
      const found = tables.find((t: any) => t.id === selectedTableId);
      if (found) return found;
    }
    const busy = tables.find((t: any) => t.status !== "EMPTY");
    return busy || tables[0] || null;
  }, [tables, selectedTableId]);

  const activeSession = useMemo(() => {
    if (!activeTable) return null;
    const fromSessions = sessions.find(
      (s: any) => s.tableId === activeTable.id && s.status === "OPEN"
    );
    if (fromSessions) return fromSessions;
    const fromTable = (activeTable.sessions || []).find(
      (s: any) => s.status === "OPEN"
    );
    return fromTable || null;
  }, [activeTable, sessions]);

  const [selectedOrderItemId, setSelectedOrderItemId] = useState<string | null>(null);

  // Keep selectedOrderItemId valid when session changes
  const allSessionItems = useMemo(() => {
    if (!activeSession) return [];
    if (Array.isArray(activeSession.items) && activeSession.items.length > 0) {
      return activeSession.items;
    }
    const fromRounds = (activeSession.rounds || []).flatMap(
      (r: any) => r.items || []
    );
    return fromRounds;
  }, [activeSession]);

  useEffect(() => {
    if (!allSessionItems.length) {
      setSelectedOrderItemId(null);
      return;
    }
    if (
      !selectedOrderItemId ||
      !allSessionItems.some((it: any) => it.id === selectedOrderItemId)
    ) {
      const draftOrHeld = allSessionItems.find(
        (it: any) =>
          it.status === "DRAFT" ||
          it.status === "HELD" ||
          it.status === "SCHEDULED"
      );
      setSelectedOrderItemId((draftOrHeld || allSessionItems[0])?.id ?? null);
    }
  }, [allSessionItems, selectedOrderItemId]);

  // ============================================================================
  // SCR-01: GİRİŞ VE KİMLİK DOĞRULAMA STATE
  // ============================================================================
  const [loginUsername, setLoginUsername] = useState<string>(
    currentUser?.username || "sistem.yoneticisi"
  );
  const [loginSecret, setLoginSecret] = useState<string>("");
  const [sharedTerminalDevice, setSharedTerminalDevice] = useState<boolean>(true);
  const [showResetHelpModal, setShowResetHelpModal] = useState<boolean>(false);

  // ============================================================================
  // SCR-02: İLK KURULUM SİHİRBAZI STATE
  // ============================================================================
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [setupRestaurantName, setSetupRestaurantName] = useState<string>(
    config?.name || "Merit Garden · A La Carte"
  );
  const [setupRestaurantCode, setSetupRestaurantCode] = useState<string>(
    config?.code || "MERIT_GARDEN_LOCAL"
  );
  const [setupTimezone, setSetupTimezone] = useState<string>(
    config?.timezone || "Europe/Istanbul"
  );
  const [setupSalonCount, setSetupSalonCount] = useState<number>(16);
  const [setupTerasCount, setSetupTerasCount] = useState<number>(8);
  const [setupAdminUsername, setSetupAdminUsername] = useState<string>(
    "sistem.yoneticisi"
  );
  const [setupAdminName, setSetupAdminName] = useState<string>(
    "Yerel Sistem Yöneticisi"
  );
  const [setupAdminPin, setSetupAdminPin] = useState<string>("");
  const [setupKeyInput, setSetupKeyInput] = useState<string>("");
  const [setupReceiptQueue, setSetupReceiptQueue] = useState<string>("Adisyon-USB");
  const [setupKitchenQueue, setSetupKitchenQueue] =
    useState<string>("Mutfak-Windows");
  const [setupChecklist, setSetupChecklist] = useState<Record<string, boolean>>({
    lanIsolated: true,
    biosAutoPower: true,
    usbReceiptVerified: true,
    bridgeApClientMode: true,
    dualBackupConfigured: true,
  });

  // ============================================================================
  // SCR-03: MASA PLANI VE MASA LİSTESİ STATE
  // ============================================================================
  const [areaFilter, setAreaFilter] = useState<string>("TÜMÜ");
  const [statusFilter, setStatusFilter] = useState<string>("TÜMÜ");
  const [tableSearch, setTableSearch] = useState<string>("");
  const [newServiceGuests, setNewServiceGuests] = useState<number>(2);

  // ============================================================================
  // SCR-04: SİPARİŞ / İŞLEM EKRANI (MICROS SIMPHONY TSR) STATE
  // ============================================================================
  const [productSearch, setProductSearch] = useState<string>("");
  const [selectedMainCategoryId, setSelectedMainCategoryId] = useState<string | null>(
    null
  );
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(
    null
  );
  const [activeSeatNumber, setActiveSeatNumber] = useState<number>(1);
  const [holdThisRoundToggle, setHoldThisRoundToggle] = useState<boolean>(false);
  const [showContextualHints, setShowContextualHints] = useState<boolean>(true);
  const [guideOpen, setGuideOpen] = useState<boolean>(true);
  const [guidePaused, setGuidePaused] = useState<boolean>(false);
  const [guideStepIndex, setGuideStepIndex] = useState<number>(0);
  const [roundIdempotencyKey, setRoundIdempotencyKey] = useState<string>(() =>
    `RND-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );

  // Sync main & sub categories
  const mainCategories = useMemo(
    () => categories.filter((c: any) => !c.parentId && c.active !== false),
    [categories]
  );

  useEffect(() => {
    if (
      mainCategories.length > 0 &&
      (!selectedMainCategoryId ||
        !mainCategories.some((c: any) => c.id === selectedMainCategoryId))
    ) {
      setSelectedMainCategoryId(mainCategories[0].id);
      setSelectedSubCategoryId(null);
    }
  }, [mainCategories, selectedMainCategoryId]);

  const subCategories = useMemo(() => {
    if (!selectedMainCategoryId) return [];
    return categories.filter(
      (c: any) => c.parentId === selectedMainCategoryId && c.active !== false
    );
  }, [categories, selectedMainCategoryId]);

  // ============================================================================
  // SCR-05: ÜRÜN SEÇENEĞİ VE KALEM DÜZENLEME STATE
  // ============================================================================
  const selectedOrderItem = useMemo(
    () =>
      allSessionItems.find((it: any) => it.id === selectedOrderItemId) ||
      allSessionItems[0] ||
      null,
    [allSessionItems, selectedOrderItemId]
  );

  const [editQuantity, setEditQuantity] = useState<number>(1);
  const [editSeatNumber, setEditSeatNumber] = useState<number | null>(1);
  const [editSharedSeats, setEditSharedSeats] = useState<number[]>([]);
  const [editKitchenNote, setEditKitchenNote] = useState<string>("");
  const [editModifiers, setEditModifiers] = useState<string[]>([]);

  useEffect(() => {
    if (!selectedOrderItem) return;
    setEditQuantity(selectedOrderItem.quantity || 1);
    setEditSeatNumber(selectedOrderItem.seatNumber ?? 1);
    setEditSharedSeats(
      safeParseJsonArray<number>(selectedOrderItem.sharedSeatsJson)
    );
    setEditKitchenNote(selectedOrderItem.kitchenNote || "");
    const mods = safeParseJsonArray<any>(selectedOrderItem.modifiersJson).map(
      (m: any) => (typeof m === "string" ? m : m?.name || m?.id || "")
    );
    setEditModifiers(mods.filter(Boolean));
  }, [selectedOrderItem]);

  // ============================================================================
  // SCR-06: BEKLETME VE ZAMANLI GÖNDERİM STATE
  // ============================================================================
  const [selectedScheduleItemIds, setSelectedScheduleItemIds] = useState<string[]>(
    []
  );
  const [scheduleScope, setScheduleScope] = useState<"SELECTED_ITEMS" | "ENTIRE_ROUND">(
    "SELECTED_ITEMS"
  );
  const [scheduleDateTime, setScheduleDateTime] = useState<string>(() =>
    defaultIstanbulDateTimeLocal(25)
  );
  const [rescheduleTargetId, setRescheduleTargetId] = useState<string | null>(null);
  const [rescheduleNewTime, setRescheduleNewTime] = useState<string>(() =>
    defaultIstanbulDateTimeLocal(40)
  );

  const pendingTableItems = useMemo(() => {
    return allSessionItems.filter(
      (it: any) =>
        it.status === "DRAFT" ||
        it.status === "HELD" ||
        it.status === "SCHEDULED" ||
        it.status === "OVERDUE"
    );
  }, [allSessionItems]);

  useEffect(() => {
    setSelectedScheduleItemIds((prev) => {
      const valid = prev.filter((id) =>
        pendingTableItems.some((it: any) => it.id === id)
      );
      if (valid.length > 0) return valid;
      return pendingTableItems.map((it: any) => it.id);
    });
  }, [pendingTableItems]);

  // ============================================================================
  // MICROS SIMPHONY TSR EXTENSIONS STATE (7 MODÜL)
  // ============================================================================
  // 1. 86 / Menü Ürün Mevcudiyeti & Porsiyon Sayacı
  const [show86Modal, setShow86Modal] = useState<boolean>(false);
  const [filter86, setFilter86] = useState<"ALL" | "86_ONLY" | "AVAILABLE">("ALL");
  const [search86, setSearch86] = useState<string>("");
  const [portionInput86, setPortionInput86] = useState<Record<string, string>>({});

  // 2. Masa Taşıma (Table Transfer)
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [transferTargetTableId, setTransferTargetTableId] = useState<string>("");
  const [transferReason, setTransferReason] = useState<string>("Misafir talebi (Masa değişikliği)");

  // 3. Masa Birleştirme (Table Merge)
  const [showMergeModal, setShowMergeModal] = useState<boolean>(false);
  const [mergeTargetTableId, setMergeTargetTableId] = useState<string>("");
  const [mergeReason, setMergeReason] = useState<string>("Grup birleşimi");

  // 4. Garson / Vardiya Devri (Server Transfer)
  const [showWaiterTransferModal, setShowWaiterTransferModal] = useState<boolean>(false);
  const [transferTargetWaiterId, setTransferTargetWaiterId] = useState<string>("");
  const [waiterTransferReason, setWaiterTransferReason] = useState<string>("Vardiya değişimi / mola");

  // 5. Mutfak Fişi Tekrar Basma (Reprint Kitchen Chit)
  const [showReprintModal, setShowReprintModal] = useState<boolean>(false);
  const [reprintTargetJobId, setReprintTargetJobId] = useState<string>("");
  const [reprintReason, setReprintReason] = useState<string>("Yazıcı kağıt sıkışması / okunaksız fiş");

  // 6. Acil / Öncelikli Fiş (Rush Order)
  const [roundRushActive, setRoundRushActive] = useState<boolean>(false);

  // 7. Ön Ek Değiştiriciler (Prefix Modifiers for SCR-05)
  const [selectedPrefix, setSelectedPrefix] = useState<
    "DEFAULT" | "NO" | "EXTRA" | "SIDE" | "LESS" | "SUB"
  >("DEFAULT");

  const PREFIX_CONFIGS = [
    { id: "DEFAULT", label: "Standart", prefixText: "" },
    { id: "NO", label: "İSTEMEZ (NO)", prefixText: "İSTEMEZ: " },
    { id: "EXTRA", label: "BOL (EXTRA)", prefixText: "BOL: " },
    { id: "SIDE", label: "AYRI (SIDE)", prefixText: "AYRI: " },
    { id: "LESS", label: "AZ (LESS)", prefixText: "AZ: " },
    { id: "SUB", label: "YERİNE (SUB)", prefixText: "YERİNE: " },
  ] as const;

  // ============================================================================
  // ACTION HANDLERS (wired to @/actions/pos and @/actions/sysadmin)
  // ============================================================================
  async function handleToggle86(menuItemId: string, is86ed?: boolean, count?: number | null) {
    setBusyAction(`toggle-86-${menuItemId}`);
    try {
      const res = await toggleMenuItem86Action({
        menuItemId,
        is86ed,
        availableCount: count,
        actorId: currentUser?.id,
      });
      if (!res.ok) {
        notify(res.error || "86 durumu güncellenemedi.", "red");
        return;
      }
      notify(
        `${res.item.name} durumu ${res.item.is86ed ? "86 (TÜKENDİ)" : "MEVCUT"}${res.item.availableCount !== null ? ` (Kalan: ${res.item.availableCount})` : ""} yapıldı.`,
        "teal"
      );
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Hata oluştu.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleTransferTable() {
    if (!activeTable || !transferTargetTableId) {
      notify("Hedef masa seçilmelidir.", "gold");
      return;
    }
    setBusyAction("transfer-table");
    try {
      const res = await transferTableAction({
        sourceTableId: activeTable.id,
        targetTableId: transferTargetTableId,
        actorId: currentUser?.id,
        reason: transferReason,
      });
      if (!res.ok) {
        notify(res.error || "Masa taşınamadı.", "red");
        return;
      }
      notify(`Masa başarıyla taşındı.`, "teal");
      setShowTransferModal(false);
      onSelectTable(transferTargetTableId);
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Masa taşıma hatası.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleMergeTable() {
    if (!activeTable || !mergeTargetTableId) {
      notify("Birleştirilecek hedef masa seçilmelidir.", "gold");
      return;
    }
    setBusyAction("merge-table");
    try {
      const res = await mergeTablesAction({
        sourceTableId: activeTable.id,
        targetTableId: mergeTargetTableId,
        actorId: currentUser?.id,
        reason: mergeReason,
      });
      if (!res.ok) {
        notify(res.error || "Masalar birleştirilemedi.", "red");
        return;
      }
      notify(`Masalar başarıyla birleştirildi.`, "teal");
      setShowMergeModal(false);
      onSelectTable(mergeTargetTableId);
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Masa birleştirme hatası.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleTransferWaiter() {
    if (!activeSession || !transferTargetWaiterId) {
      notify("Hedef garson seçilmelidir.", "gold");
      return;
    }
    setBusyAction("transfer-waiter");
    try {
      const res = await transferSessionWaiterAction({
        sessionId: activeSession.id,
        targetUserId: transferTargetWaiterId,
        actorId: currentUser?.id,
        reason: waiterTransferReason,
      });
      if (!res.ok) {
        notify(res.error || "Masa devredilemedi.", "red");
        return;
      }
      notify(`Masa sorumluluğu ${res.newWaiterName} personeline devredildi.`, "teal");
      setShowWaiterTransferModal(false);
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Garson devir hatası.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleToggleRoundRush() {
    const draftRound = (activeSession?.rounds || []).find(
      (r: any) => r.status === "DRAFT" || r.status === "HELD"
    );
    if (!draftRound) {
      setRoundRushActive((v) => !v);
      notify(`Yeni tur için RUSH (Acil) modu ${!roundRushActive ? "AÇILDI" : "KAPATILDI"}.`, "gold");
      return;
    }
    setBusyAction("toggle-rush");
    try {
      const res = await toggleRoundRushAction({
        roundId: draftRound.id,
        actorId: currentUser?.id,
      });
      if (!res.ok) {
        notify(res.error || "Acil modu değiştirilemedi.", "red");
        return;
      }
      setRoundRushActive(res.isRush);
      notify(`Tur ${draftRound.roundNumber} için ACİL / RUSH modu ${res.isRush ? "AÇILDI" : "KAPATILDI"}.`, "teal");
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Hata oluştu.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleToggleItemRush(itemId: string) {
    setBusyAction(`item-rush-${itemId}`);
    try {
      const res = await toggleItemRushAction({
        itemId,
        actorId: currentUser?.id,
      });
      if (!res.ok) {
        notify(res.error || "Kalem acil bayrağı değiştirilemedi.", "red");
        return;
      }
      notify(`Kalem için ACİL / RUSH ${res.isRush ? "AÇILDI" : "KAPATILDI"}.`, "teal");
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Hata oluştu.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReorderRound(sourceRoundId?: string) {
    if (!activeSession) {
      notify("Açık masa servisi bulunamadı.", "gold");
      return;
    }
    setBusyAction("reorder-round");
    try {
      const res = await reorderRoundAction({
        sessionId: activeSession.id,
        sourceRoundId,
        actorId: currentUser?.id,
      });
      if (!res.ok) {
        notify(res.error || "Tur tekrarlanamadı.", "red");
        return;
      }
      notify(
        `${res.clonedCount} kalem yeni tura tekrarlandı (Re-Order).${res.skipped86Count > 0 ? ` (${res.skipped86Count} tükenen kalem atlandı)` : ""}`,
        "teal"
      );
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Hata oluştu.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReprintKitchenChit(targetJobId?: string) {
    const jobToReprint = targetJobId || reprintTargetJobId;
    if (!jobToReprint) {
      notify("Tekrar basılacak mutfak fişi seçilmelidir.", "gold");
      return;
    }
    setBusyAction("reprint-chit");
    try {
      const res = await reprintKitchenChitAction({
        printJobId: jobToReprint,
        actorId: currentUser?.id,
        reason: reprintReason,
      });
      if (!res.ok) {
        notify(res.error || "Fiş tekrar basılamadı.", "red");
        return;
      }
      notify(
        `Mutfak fişi DUPLICATE (Kopya) olarak tekrar basım kuyruğuna alındı (${res.printJob.jobCode}).`,
        "teal"
      );
      setShowReprintModal(false);
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Tekrar basım hatası.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusyAction("login");
    try {
      const res = await loginAction({
        username: loginUsername.trim(),
        secret: loginSecret,
        deviceLabel: sharedTerminalDevice
          ? "Ortak Servis Terminali"
          : "Kişisel Terminal",
      });
      if (!res.ok) {
        notify(res.error || "Giriş başarısız oldu.", "red");
        return;
      }
      if (res.user) {
        onSwitchUser(res.user);
      }
      notify(
        `${res.user?.name || loginUsername} olarak yerel sunucu oturumu açıldı.`,
        "teal"
      );
      onRefresh();
      onNavigate("SCR-03");
    } catch (err: any) {
      notify(err?.message || "Giriş sırasında sunucu hatası oluştu.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleQuickSwitchAccount(username: string) {
    setLoginUsername(username);
    setLoginSecret("");
    notify("Hesap adı seçildi. Oturumu değiştirmek için ilgili kullanıcının kendi parolasını veya PIN kodunu girin.", "gold");
  }

  async function handleCompleteSetupWizard() {
    setBusyAction("wizard-complete");
    try {
      const adminUser =
        users.find((u: any) => u.role === "SYSTEM_ADMIN") || currentUser;
      const res = await completeSetupWizardAction({
        actorId: adminUser?.id || currentUser?.id,
        restaurantName: setupRestaurantName,
        timezone: setupTimezone,
        tableCount: setupSalonCount + setupTerasCount,
        adminName: setupAdminName,
        adminUsername: setupAdminUsername,
      });
      if (!res.ok) {
        notify("Kurulum tamamlanamadı.", "red");
        return;
      }
      notify(
        "İlk kurulum sihirbazı tamamlandı ve denetim günlüğüne kaydedildi.",
        "teal"
      );
      onRefresh();
      onNavigate("SCR-03");
    } catch (err: any) {
      notify(err?.message || "Kurulum kaydedilirken hata oluştu.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleOpenOrResumeTable(tableObj: any, guestCountOverride?: number) {
    if (!tableObj) return;
    onSelectTable(tableObj.id);
    setBusyAction(`open-table-${tableObj.id}`);
    try {
      const res = await openOrResumeTableAction({
        actorId: currentUser?.id,
        tableId: tableObj.id,
        guestCount: guestCountOverride ?? newServiceGuests,
      });
      if (!res.ok) {
        notify(res.error || "Masa açılamadı.", "red");
        return;
      }
      onRefresh();
      onNavigate("SCR-04");
      notify(
        `${tableObj.name} sipariş ekranı açıldı (${res.session.referenceCode}).`,
        "teal"
      );
    } catch (err: any) {
      notify(err?.message || "Masa servisi başlatılırken hata oluştu.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUpdateGuestSeat(newGuests: number, newSeats: number) {
    if (!activeSession) {
      notify("Önce masada açık servis başlatın.", "gold");
      return;
    }
    const safeGuests = Math.max(1, Math.min(50, newGuests));
    const safeSeats = Math.max(1, Math.min(50, newSeats));
    setBusyAction("guest-seat");
    try {
      const res = await updateGuestAndSeatCountAction({
        actorId: currentUser?.id,
        sessionId: activeSession.id,
        guestCount: safeGuests,
        seatCount: safeSeats,
      });
      if (!res.ok) {
        notify(res.error || "Kuver/koltuk güncellenemedi.", "red");
        return;
      }
      onRefresh();
      if (res.outOfRangeSeatWarning) {
        notify(res.outOfRangeSeatWarning, "gold");
      } else {
        notify(
          `Misafir: ${safeGuests} · Koltuk: ${safeSeats} olarak güncellendi.`,
          "teal"
        );
      }
    } catch (err: any) {
      notify(err?.message || "Kuver/koltuk güncellenemedi.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleAddDraftItem(menuItem: any) {
    if (!activeTable) {
      notify("Lütfen önce bir masa seçin.", "red");
      return;
    }
    setBusyAction(`add-item-${menuItem.id}`);
    try {
      let targetSessionId = activeSession?.id;
      if (!targetSessionId) {
        const opened = await openOrResumeTableAction({
          actorId: currentUser?.id,
          tableId: activeTable.id,
          guestCount: newServiceGuests,
        });
        if (!opened.ok) {
          notify(opened.error || "Masa oturumu açılamadı.", "red");
          return;
        }
        targetSessionId = opened.session.id;
      }

      const res = await addDraftItemAction({
        actorId: currentUser?.id,
        sessionId: targetSessionId,
        menuItemId: menuItem.id,
        quantity: 1,
        seatNumber: activeSeatNumber,
        holdItem: holdThisRoundToggle,
      });
      if (!res.ok) {
        notify(res.error || "Ürün eklenemedi.", "red");
        return;
      }
      if (res.item?.id) {
        setSelectedOrderItemId(res.item.id);
      }
      onRefresh();
      notify(
        `${menuItem.receiptName || menuItem.name} (Koltuk ${activeSeatNumber})${
          holdThisRoundToggle ? " [BEKLETİLDİ]" : ""
        } eklendi.`,
        holdThisRoundToggle ? "gold" : "teal"
      );
    } catch (err: any) {
      notify(err?.message || "Ürün eklenirken hata oluştu.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSendRoundToKitchen() {
    if (!activeSession) {
      notify("Bu masada aktif servis oturumu bulunmuyor.", "gold");
      return;
    }
    const draftItems = allSessionItems.filter((it: any) => it.status === "DRAFT");
    if (draftItems.length === 0) {
      notify(
        "Mutfağa gönderilecek yeni (TASLAK) kalem bulunmuyor. Bekletilen kalemler için SCR-06'yı kullanın.",
        "gold"
      );
      return;
    }
    setBusyAction("send-kitchen");
    try {
      const res = await sendRoundToKitchenAction({
        actorId: currentUser?.id,
        sessionId: activeSession.id,
        idempotencyKey: roundIdempotencyKey,
      });
      if (!res.ok) {
        notify(res.error || "Mutfağa gönderim başarısız.", "red");
        return;
      }
      setRoundIdempotencyKey(
        `RND-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      );
      onRefresh();
      notify(
        `${draftItems.length} kalem kaydedildi ve uygulama çıktısı kuyruğunda bekliyor. Coolify demosunda fiziksel yazıcıya teslim doğrulanmadı.`,
        "gold"
      );
    } catch (err: any) {
      notify(err?.message || "Mutfağa gönderim sırasında hata oluştu.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUpdateDraftItem() {
    if (!selectedOrderItem) return;
    setBusyAction("update-item");
    try {
      const isSent = selectedOrderItem.status === "SENT";
      const res = await updateDraftItemAction({
        actorId: currentUser?.id,
        itemId: selectedOrderItem.id,
        seatNumber: editSeatNumber,
        sharedSeats: editSharedSeats,
        ...(isSent
          ? {}
          : {
              quantity: editQuantity,
              modifiers: editModifiers,
              kitchenNote: editKitchenNote.trim() || null,
            }),
      });
      if (!res.ok) {
        notify(res.error || "Kalem güncellenemedi.", "red");
        return;
      }
      onRefresh();
      notify(
        `${selectedOrderItem.productNameSnapshot} kalem seçenekleri ve koltuk bilgileri güncellendi.`,
        "teal"
      );
    } catch (err: any) {
      notify(err?.message || "Kalem güncellenirken hata oluştu.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRemoveDraftItem(item: any) {
    if (!item) return;
    if (item.status === "SENT") {
      notify(
        "Mutfağa gönderilmiş kalem doğrudan silinemez! İptal Talebi (SCR-09) ekranına yönlendiriliyorsunuz.",
        "gold"
      );
      onNavigate("SCR-09");
      return;
    }
    setBusyAction(`remove-${item.id}`);
    try {
      const res = await removeDraftItemAction({
        actorId: currentUser?.id,
        itemId: item.id,
        reason: "Gönderim öncesi garson tarafından taslaktan kaldırıldı",
      });
      if (!res.ok) {
        notify(res.error || "Kalem kaldırılamadı.", "red");
        return;
      }
      onRefresh();
      notify(
        `${item.productNameSnapshot} taslaktan kaldırıldı (Audit kaydı oluşturuldu).`,
        "gold"
      );
    } catch (err: any) {
      notify(err?.message || "Kalem kaldırılırken hata oluştu.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleHoldOrSchedule(
    mode: "HOLD_ITEMS" | "HOLD_ROUND" | "FIRE_NOW" | "SCHEDULE" | "UNSCHEDULE" | "RESCHEDULE",
    customItemIds?: string[],
    customScheduledAt?: string | null,
    targetSessionId?: string
  ) {
    const itemIds =
      customItemIds && customItemIds.length > 0
        ? customItemIds
        : scheduleScope === "ENTIRE_ROUND" && mode === "SCHEDULE"
        ? undefined
        : selectedScheduleItemIds;

    const resolvedSessionId = targetSessionId || activeSession?.id;
    if (!resolvedSessionId) {
      notify("Aktif masa servis oturumu bulunamadı.", "red");
      return;
    }

    setBusyAction(`schedule-${mode}`);
    try {
      const draftRound = (activeSession?.rounds || []).find(
        (r: any) =>
          r.status === "DRAFT" ||
          r.status === "HELD" ||
          r.status === "SCHEDULED"
      );
      const apiMode =
        mode === "UNSCHEDULE"
          ? "CLEAR_SCHEDULE"
          : mode === "RESCHEDULE"
          ? "SCHEDULE"
          : mode;

      const res = await holdOrScheduleAction({
        actorId: currentUser?.id,
        sessionId: resolvedSessionId,
        roundId: draftRound?.id,
        itemIds,
        mode: apiMode,
        scheduledAtIso:
          mode === "SCHEDULE"
            ? new Date(scheduleDateTime).toISOString()
            : mode === "RESCHEDULE" && customScheduledAt
            ? new Date(customScheduledAt).toISOString()
            : null,
      });
      if (!res.ok) {
        notify(res.error || "Zamanlama işlemi başarısız.", "red");
        return;
      }
      onRefresh();
      const labels: Record<string, string> = {
        HOLD_ITEMS: "Seçili kalemler BEKLETİLDİ durumuna alındı.",
        HOLD_ROUND: "Aktif servis turu BEKLETİLDİ durumuna alındı.",
        FIRE_NOW: "Seçili kalemler serbest bırakıldı ve mutfak kuyruğuna gönderildi!",
        SCHEDULE: `Zamanlı gönderim (${scheduleDateTime.replace("T", " ")}) yerel sunucuya kaydedildi.`,
        UNSCHEDULE: "Zamanlama kaldırıldı ve audit kaydı yazıldı.",
        RESCHEDULE: "Gönderim saati güncellendi ve audit günlüğüne işlendi.",
      };
      notify(labels[mode] || "Gönderim planı güncellendi.", "teal");
      setRescheduleTargetId(null);
    } catch (err: any) {
      notify(err?.message || "Bekletme/zamanlama hatası oluştu.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleEvaluateScheduledItems() {
    setBusyAction("eval-schedules");
    try {
      const res = await evaluateScheduledItemsAction({
        actorId: currentUser?.id,
      });
      if (!res.ok) {
        notify("Zamanlayıcı kontrolü başarısız.", "red");
        return;
      }
      onRefresh();
      notify(
        res.affectedItems > 0
          ? `Sunucu zamanlayıcısı: ${res.affectedItems} kalem değerlendirildi (${res.status}).`
          : "Sunucu zamanlayıcısı kontrol edildi; şu an vadesi gelmiş bekleyen plan yok.",
        "teal"
      );
    } catch (err: any) {
      notify(err?.message || "Zamanlayıcı kontrolünde hata oluştu.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  // ============================================================================
  // RENDER MICROS MODALS (7 MODÜL YARDIMCI PENCERELERİ)
  // ============================================================================
  function renderMicrosModals() {
    return (
      <>
        {/* 1. MODAL: MICROS 86 / TÜKENEN ÜRÜNLER (ITEM AVAILABILITY) */}
        {show86Modal && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-[#344647] bg-[#192526] shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#344647] bg-[#141f20] px-5 py-3.5">
                <div>
                  <div className="text-[10px] font-extrabold tracking-widest text-[#efc97b] uppercase">
                    MICROS SIMPHONY · MENÜ MEVCUDİYETİ
                  </div>
                  <h3 className="text-base font-black text-[#f0f5f3]">
                    86 / Tükenen Ürünler ve Porsiyon Sayacı
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShow86Modal(false)}
                  className="rounded-lg border border-[#344647] bg-[#202f30] px-2.5 py-1 text-xs text-[#9aaead] hover:text-[#f0f5f3]"
                >
                  ✕ Kapat
                </button>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#344647] bg-[#162223] px-4 py-2.5">
                <input
                  type="search"
                  value={search86}
                  onChange={(e) => setSearch86(e.target.value)}
                  placeholder="Ürün adı veya istasyon ara..."
                  className="w-full sm:w-64 rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-1.5 text-xs text-[#f0f5f3] focus:border-[#73d8c6] focus:outline-none"
                />
                <div className="flex items-center gap-1">
                  {(
                    [
                      { id: "ALL", label: "Tümü" },
                      { id: "86_ONLY", label: "🚫 Yalnızca 86" },
                      { id: "AVAILABLE", label: "✓ Mevcutlar" },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilter86(f.id)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition border ${
                        filter86 === f.id
                          ? "border-[#efc97b] bg-[#393321] text-[#f2d38f]"
                          : "border-transparent bg-[#202f30] text-[#9aaead]"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Items List */}
              <div className="flex-1 divide-y divide-[#2a3838] overflow-y-auto p-3 space-y-1">
                {menuItems
                  .filter((item: any) => {
                    const q = search86.trim().toLocaleLowerCase("tr-TR");
                    const nameMatch =
                      !q ||
                      item.name.toLocaleLowerCase("tr-TR").includes(q) ||
                      (item.station?.name || "").toLocaleLowerCase("tr-TR").includes(q);
                    const is86 = item.is86ed || (item.availableCount !== null && item.availableCount <= 0);
                    if (filter86 === "86_ONLY") return nameMatch && is86;
                    if (filter86 === "AVAILABLE") return nameMatch && !is86;
                    return nameMatch;
                  })
                  .map((item: any) => {
                    const is86 = item.is86ed || (item.availableCount !== null && item.availableCount <= 0);
                    const currentCountInput = portionInput86[item.id] ?? (item.availableCount !== null ? String(item.availableCount) : "");
                    return (
                      <div
                        key={item.id}
                        className={`flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl transition ${
                          is86 ? "bg-[#2d1e1d] border border-[#6b3531]" : "bg-[#141f20] hover:bg-[#192728]"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-[#f0f5f3]">{item.name}</span>
                            <span className="rounded bg-[#202c2d] px-1.5 py-0.5 text-[9px] font-bold text-[#73d8c6]">
                              {item.station?.name || "Mutfak"}
                            </span>
                            {is86 && (
                              <span className="rounded bg-[#5c2420] px-2 py-0.5 text-[9px] font-black text-[#ffc4bc] border border-[#7a3531]">
                                86 · TÜKENDİ
                              </span>
                            )}
                            {item.availableCount !== null && item.availableCount > 0 && (
                              <span className="rounded bg-[#453316] px-2 py-0.5 text-[9px] font-black text-[#ffd68a] border border-[#694e22]">
                                Kalan: {item.availableCount} Porsiyon
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {/* Portion Counter Input */}
                          <div className="flex items-center gap-1 bg-[#101a1a] rounded-lg border border-[#344647] px-2 py-1">
                            <span className="text-[10px] text-[#9aaead]">Adet:</span>
                            <input
                              type="number"
                              min="0"
                              max="999"
                              value={currentCountInput}
                              onChange={(e) =>
                                setPortionInput86((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                              placeholder="Limitsiz"
                              className="w-14 bg-transparent text-xs text-[#f0f5f3] text-center focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const val = currentCountInput.trim();
                                const parsed = val === "" ? null : Math.max(0, parseInt(val, 10));
                                handleToggle86(item.id, parsed === 0 ? true : false, parsed);
                              }}
                              className="rounded bg-[#384a48] px-2 py-0.5 text-[10px] font-extrabold text-[#73d8c6] hover:bg-[#485d5b]"
                            >
                              Kaydet
                            </button>
                          </div>

                          {/* Instant 86 Toggle */}
                          <button
                            type="button"
                            disabled={busyAction === `toggle-86-${item.id}`}
                            onClick={() => handleToggle86(item.id, !is86, is86 ? null : 0)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-black transition border ${
                              is86
                                ? "border-[#58b7a6] bg-[#244440] text-[#73d8c6]"
                                : "border-[#754541] bg-[#452c2a] text-[#ffc7be]"
                            }`}
                          >
                            {is86 ? "✓ Mevcut Yap" : "🚫 86 (Tükendi)"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* 2. MODAL: MASA TAŞIMA (TABLE TRANSFER) */}
        {showTransferModal && activeTable && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-lg rounded-2xl border border-[#344647] bg-[#192526] p-5 shadow-2xl">
              <div className="text-[10px] font-extrabold tracking-widest text-[#73d8c6] uppercase">
                MICROS SIMPHONY · MASA TAŞIMA (TABLE TRANSFER)
              </div>
              <h3 className="mt-1 text-base font-black text-[#f0f5f3]">
                {activeTable.name} Masasını Başka Bir Masaya Taşı
              </h3>
              <p className="mt-1 text-xs text-[#9aaead]">
                Açık oturum ({activeSession?.referenceCode}) tüm turları, kalemleri ve kuverleriyle seçilen boş masaya devredilir.
              </p>

              <div className="mt-4">
                <label className="block text-[10px] font-extrabold text-[#aab9b6] uppercase mb-1.5">
                  HEDEF BOŞ MASA SEÇİN:
                </label>
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                  {tables
                    .filter((t: any) => t.status === "EMPTY" && t.id !== activeTable.id)
                    .map((t: any) => {
                      const selected = transferTargetTableId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTransferTargetTableId(t.id)}
                          className={`rounded-xl border p-2.5 text-left transition ${
                            selected
                              ? "border-[#73d8c6] bg-[#244440] text-white"
                              : "border-[#344647] bg-[#141f20] text-[#c4cfcd] hover:border-[#58b7a6]"
                          }`}
                        >
                          <div className="text-xs font-black">{t.name}</div>
                          <div className="text-[9px] text-[#9aaead]">{t.area?.name || "Salon"} · Kapasite {t.capacity}</div>
                        </button>
                      );
                    })}
                </div>
                {tables.filter((t: any) => t.status === "EMPTY" && t.id !== activeTable.id).length === 0 && (
                  <div className="p-3 text-center text-xs text-[#f18d83] rounded-lg bg-[#3a2625] border border-[#684442]">
                    Şu an restoranda boş masa bulunmuyor.
                  </div>
                )}
              </div>

              <div className="mt-3">
                <label className="block text-[10px] font-extrabold text-[#aab9b6] uppercase mb-1">
                  TAŞIMA NEDENİ:
                </label>
                <input
                  type="text"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3]"
                  placeholder="Misafir talebi (rüzgar, geniş masa vb.)"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-[#2d3d3d] pt-3">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="rounded-xl border border-[#344647] bg-[#202f30] px-4 py-2 text-xs font-bold text-[#f0f5f3]"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  disabled={!transferTargetTableId || busyAction === "transfer-table"}
                  onClick={handleTransferTable}
                  className="rounded-xl border border-[#58b7a6] bg-[#73d8c6] px-5 py-2 text-xs font-black text-[#10221f] disabled:opacity-40"
                >
                  {busyAction === "transfer-table" ? "Taşınıyor..." : "Masayı Taşı ✓"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. MODAL: MASA BİRLEŞTİRME (TABLE MERGE) */}
        {showMergeModal && activeTable && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-lg rounded-2xl border border-[#344647] bg-[#192526] p-5 shadow-2xl">
              <div className="text-[10px] font-extrabold tracking-widest text-[#efc97b] uppercase">
                MICROS SIMPHONY · MASA BİRLEŞTİRME (TABLE MERGE)
              </div>
              <h3 className="mt-1 text-base font-black text-[#f0f5f3]">
                {activeTable.name} Masasını Başka Bir Açık Masa ile Birleştir
              </h3>
              <p className="mt-1 text-xs text-[#9aaead]">
                Bu masanın tüm siparişleri ve misafirleri seçilen hedef masaya eklenir; {activeTable.name} kapatılarak boşaltılır.
              </p>

              <div className="mt-4">
                <label className="block text-[10px] font-extrabold text-[#aab9b6] uppercase mb-1.5">
                  BİRLEŞTİRİLECEK AÇIK HEDEF MASA:
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                  {tables
                    .filter((t: any) => t.status !== "EMPTY" && t.id !== activeTable.id)
                    .map((t: any) => {
                      const selected = mergeTargetTableId === t.id;
                      const s = sessions.find((ses: any) => ses.tableId === t.id && ses.status === "OPEN");
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setMergeTargetTableId(t.id)}
                          className={`rounded-xl border p-2.5 text-left transition ${
                            selected
                              ? "border-[#efc97b] bg-[#393321] text-white"
                              : "border-[#344647] bg-[#141f20] text-[#c4cfcd] hover:border-[#58b7a6]"
                          }`}
                        >
                          <div className="text-xs font-black">{t.name}</div>
                          <div className="text-[9px] text-[#73d8c6]">{s?.referenceCode || "Açık"} · {s?.guestCount || 2} Misafir</div>
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-[10px] font-extrabold text-[#aab9b6] uppercase mb-1">
                  BİRLEŞTİRME AÇIKLAMASI:
                </label>
                <input
                  type="text"
                  value={mergeReason}
                  onChange={(e) => setMergeReason(e.target.value)}
                  className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3]"
                  placeholder="Grup birleşti / misafirler aynı masaya geçti"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-[#2d3d3d] pt-3">
                <button
                  type="button"
                  onClick={() => setShowMergeModal(false)}
                  className="rounded-xl border border-[#344647] bg-[#202f30] px-4 py-2 text-xs font-bold text-[#f0f5f3]"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  disabled={!mergeTargetTableId || busyAction === "merge-table"}
                  onClick={handleMergeTable}
                  className="rounded-xl border border-[#6b5837] bg-[#efc97b] px-5 py-2 text-xs font-black text-[#192526] disabled:opacity-40"
                >
                  {busyAction === "merge-table" ? "Birleştiriliyor..." : "Masaları Birleştir ⇶"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. MODAL: GARSON VE VARDİYA DEVRİ (SERVER TRANSFER) */}
        {showWaiterTransferModal && activeSession && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-md rounded-2xl border border-[#344647] bg-[#192526] p-5 shadow-2xl">
              <div className="text-[10px] font-extrabold tracking-widest text-[#8dc4e9] uppercase">
                MICROS SIMPHONY · GARSON VE VARDİYA DEVRİ
              </div>
              <h3 className="mt-1 text-base font-black text-[#f0f5f3]">
                Masa Sorumluluğunu Başka Personele Devret
              </h3>
              <p className="mt-1 text-xs text-[#9aaead]">
                Mevcut Garson: <strong className="text-[#f0f5f3]">{activeSession.openedBy?.name || currentUser?.name}</strong>
              </p>

              <div className="mt-4">
                <label className="block text-[10px] font-extrabold text-[#aab9b6] uppercase mb-1.5">
                  YENİ SORUMLU GARSON / YÖNETİCİ SEÇİN:
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {users
                    .filter((u: any) => u.active !== false && u.id !== activeSession.openedById)
                    .map((u: any) => {
                      const selected = transferTargetWaiterId === u.id;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setTransferTargetWaiterId(u.id)}
                          className={`w-full flex items-center justify-between rounded-xl border p-2.5 text-left transition ${
                            selected
                              ? "border-[#8dc4e9] bg-[#1c2c38] text-white"
                              : "border-[#344647] bg-[#141f20] text-[#c4cfcd] hover:border-[#58b7a6]"
                          }`}
                        >
                          <div className="text-xs font-bold">{u.name}</div>
                          <span className="text-[10px] text-[#9aaead]">{u.role === "RESTAURANT_MANAGER" ? "Restoran Yön." : "Garson"}</span>
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-[10px] font-extrabold text-[#aab9b6] uppercase mb-1">
                  DEVİR NEDENİ:
                </label>
                <input
                  type="text"
                  value={waiterTransferReason}
                  onChange={(e) => setWaiterTransferReason(e.target.value)}
                  className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3]"
                  placeholder="Mola / Vardiya değişimi"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-[#2d3d3d] pt-3">
                <button
                  type="button"
                  onClick={() => setShowWaiterTransferModal(false)}
                  className="rounded-xl border border-[#344647] bg-[#202f30] px-4 py-2 text-xs font-bold text-[#f0f5f3]"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  disabled={!transferTargetWaiterId || busyAction === "transfer-waiter"}
                  onClick={handleTransferWaiter}
                  className="rounded-xl border border-[#48536b] bg-[#8dc4e9] px-5 py-2 text-xs font-black text-[#10221f] disabled:opacity-40"
                >
                  {busyAction === "transfer-waiter" ? "Devrediliyor..." : "Sorumluluğu Devret 👤"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. MODAL: MUTFAK FİŞİ TEKRAR BASIM (REPRINT CHIT) */}
        {showReprintModal && activeSession && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-md rounded-2xl border border-[#344647] bg-[#192526] p-5 shadow-2xl">
              <div className="text-[10px] font-extrabold tracking-widest text-[#f18d83] uppercase">
                MICROS SIMPHONY · MUTFAK FİŞİ TEKRAR BASIM
              </div>
              <h3 className="mt-1 text-base font-black text-[#f0f5f3]">
                Mutfak Yazıcısına Kopya (Duplicate) Gönder
              </h3>
              <div className="mt-2 rounded-xl border border-[#754541] bg-[#3a2625] p-2.5 text-[11px] text-[#ffc4bc]">
                <strong>DUPLICATE KORUMASI:</strong> Mükerrer yemek pişmesini önlemek için mutfak çıktısında büyük <strong>*** TEKRAR BASKI (DUPLICATE) ***</strong> damgası yer alacaktır.
              </div>

              <div className="mt-4">
                <label className="block text-[10px] font-extrabold text-[#aab9b6] uppercase mb-1.5">
                  TEKRAR BASILACAK FİŞİ SEÇİN:
                </label>
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {(activeSession.printJobs || [])
                    .filter((pj: any) => pj.jobType === "KITCHEN_ORDER")
                    .map((pj: any) => {
                      const selected = reprintTargetJobId === pj.id;
                      return (
                        <button
                          key={pj.id}
                          type="button"
                          onClick={() => setReprintTargetJobId(pj.id)}
                          className={`w-full flex items-center justify-between rounded-xl border p-2.5 text-left transition ${
                            selected
                              ? "border-[#f18d83] bg-[#4a2625] text-white"
                              : "border-[#344647] bg-[#141f20] text-[#c4cfcd] hover:border-[#58b7a6]"
                          }`}
                        >
                          <div>
                            <div className="text-xs font-black">{pj.jobCode} · {pj.stationName}</div>
                            <div className="text-[9px] text-[#9aaead]">{pj.scopeDescription || "Mutfak Turu"}</div>
                          </div>
                          <span className="font-mono text-[10px] text-[#73d8c6]">{formatIstanbulTime(pj.createdAt)}</span>
                        </button>
                      );
                    })}
                  {(activeSession.printJobs || []).filter((pj: any) => pj.jobType === "KITCHEN_ORDER").length === 0 && (
                    <div className="p-3 text-center text-xs text-[#9aaead] rounded-lg bg-[#141f20]">
                      Bu masada henüz basılmış mutfak fişi bulunmuyor.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-[10px] font-extrabold text-[#aab9b6] uppercase mb-1">
                  TEKRAR BASIM NEDENİ:
                </label>
                <input
                  type="text"
                  value={reprintReason}
                  onChange={(e) => setReprintReason(e.target.value)}
                  className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3]"
                  placeholder="Yazıcı kağıdı sıkıştı / şef fişi kaybetti"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-[#2d3d3d] pt-3">
                <button
                  type="button"
                  onClick={() => setShowReprintModal(false)}
                  className="rounded-xl border border-[#344647] bg-[#202f30] px-4 py-2 text-xs font-bold text-[#f0f5f3]"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  disabled={!reprintTargetJobId || busyAction === "reprint-chit"}
                  onClick={() => handleReprintKitchenChit()}
                  className="rounded-xl border border-[#754541] bg-[#e0584b] px-5 py-2 text-xs font-black text-white disabled:opacity-40"
                >
                  {busyAction === "reprint-chit" ? "Yazdırılıyor..." : "Kopya Fişi Bas 🖨️"}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ============================================================================
  // RENDER SCR-01: GİRİŞ VE KİMLİK DOĞRULAMA
  // ============================================================================
  if (activeScreen === "SCR-01") {
    const demoAccounts = [
      {
        username: "sistem.yoneticisi",
        label: "Sistem Yöneticisi",
        roleBadge: "SYSTEM_ADMIN",
        desc: "Kurulum, menü, kullanıcı, yedek, audit ve tanılama",
      },
      {
        username: "mehmet.kaya",
        label: "Mehmet Kaya",
        roleBadge: "RESTAURANT_MANAGER",
        desc: "Operasyon panosu, iptal kararı, fiyatsız adisyon, raporlar",
      },
      {
        username: "ayse.yilmaz",
        label: "Ayşe Yılmaz",
        roleBadge: "WAITER",
        desc: "Garson · Masa planı, TSR sipariş, koltuk/modifier, zamanlama",
      },
      {
        username: "deniz.kaya",
        label: "Deniz Kaya",
        roleBadge: "WAITER",
        desc: "Garson · Tüm masaları görür, ortak/kişisel terminal desteği",
      },
    ];

    return (
      <div className="mx-auto my-4 max-w-4xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#91ead8] to-[#4bad9b] text-lg font-black text-[#10201e] shadow-lg">
              A
            </div>
            <div>
              <div className="text-[10px] font-extrabold tracking-[0.18em] text-[#73d8c6] uppercase">
                SCR-01 · KİMLİK DOĞRULAMA VE YEREL OTURUM
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#f0f5f3]">
                {config?.name || "Merit Garden · A La Carte"} — Personel Girişi
              </h1>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#3c6058] bg-[#243d39] px-3 py-1 text-xs font-semibold text-[#bdf0e4]">
            <span>●</span> Kapalı LAN · Sunucu: Europe/Istanbul
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Login Form Card */}
          <div className="rounded-2xl border border-[#344647] bg-[#192526] p-6 shadow-xl lg:col-span-7">
            <div className="mb-1 text-[10px] font-extrabold tracking-[0.16em] text-[#73d8c6] uppercase">
              KİŞİSEL HESAP DOĞRULAMA
            </div>
            <h2 className="text-lg font-bold text-[#f0f5f3]">
              Restoran Hesabına Giriş Yapın
            </h2>
            <p className="mt-1 mb-5 text-xs text-[#9aaead]">
              Ortak garson hesabı kullanılmaz. Her işlem kişisel kullanıcı kimliği ve
              sunucu zaman damgasıyla denetim izine (AuditLog) kaydedilir.
            </p>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="pos-login-username"
                  className="mb-1.5 block text-[10px] font-extrabold tracking-wider text-[#aab9b6] uppercase"
                >
                  KULLANICI ADI
                </label>
                <input
                  id="pos-login-username"
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  autoComplete="username"
                  required
                  className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3.5 py-2.5 text-sm text-[#f0f5f3] focus:border-[#73d8c6] focus:outline-none"
                  placeholder="örn. ayse.yilmaz"
                />
              </div>

              <div>
                <label
                  htmlFor="pos-login-secret"
                  className="mb-1.5 block text-[10px] font-extrabold tracking-wider text-[#aab9b6] uppercase"
                >
                  PAROLA VEYA KİŞİSEL PIN
                </label>
                <input
                  id="pos-login-secret"
                  type="password"
                  value={loginSecret}
                  onChange={(e) => setLoginSecret(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3.5 py-2.5 text-sm text-[#f0f5f3] focus:border-[#73d8c6] focus:outline-none"
                  placeholder="••••••"
                />
              </div>

              <div className="flex items-center justify-between gap-2 rounded-lg border border-[#2d3d3d] bg-[#141f20] px-3 py-2.5">
                <label
                  htmlFor="shared-terminal-check"
                  className="flex cursor-pointer items-center gap-2.5 text-xs text-[#c4cfcd]"
                >
                  <input
                    id="shared-terminal-check"
                    type="checkbox"
                    checked={sharedTerminalDevice}
                    onChange={(e) => setSharedTerminalDevice(e.target.checked)}
                    className="h-4 w-4 accent-[#73d8c6]"
                  />
                  <span>
                    Bu cihazı ortak terminal olarak kullanıyorum (Kısa hareketsizlik
                    kilidi aktif)
                  </span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={busyAction === "login"}
                  className="flex-1 rounded-xl border border-[#58b7a6] bg-[#73d8c6] px-4 py-2.5 text-xs font-extrabold text-[#10221f] transition hover:brightness-110 disabled:opacity-50"
                >
                  {busyAction === "login"
                    ? "Doğrulanıyor..."
                    : "Giriş Yap ve Masa Planını Aç →"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetHelpModal(true)}
                  className="rounded-xl border border-[#344647] bg-[#202f30] px-3.5 py-2.5 text-xs font-bold text-[#f0f5f3] hover:border-[#73d8c6]"
                >
                  Yönetici Parola Yardımı
                </button>
              </div>
            </form>

            {/* Closed LAN / No Internet / No PMS Security Notice */}
            <div className="mt-5 rounded-xl border border-[#3c6259] bg-[#1c3531] p-3.5 text-xs leading-relaxed text-[#c0eee5]">
              <div className="font-bold text-[#73d8c6]">
                ● Güvenli Yerel Ağ (Kapalı LAN) Çalışma Garantisi
              </div>
              <p className="mt-1 text-[11px]">
                İnternet, bulut, otel PMS/oda hesabı, fiyatlandırma, vergi veya ödeme
                bağlantısı kullanılmaz. Başarısız giriş denemeleri hesabı geçici olarak
                kilitler ve denetim günlüğüne (SCR-13) kaydedilir.
              </p>
            </div>
          </div>

          {/* Quick Demo Account Switcher Card */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#344647] bg-[#192526] p-5 shadow-xl lg:col-span-5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold tracking-[0.16em] text-[#efc97b] uppercase">
                  HIZLI DEMO HESAP GEÇİŞİ
                </span>
                <span className="rounded-full border border-[#665637] bg-[#3b3325] px-2.5 py-0.5 text-[10px] font-bold text-[#f2d38f]">
                  Anında Test
                </span>
              </div>
              <h3 className="mt-1 text-sm font-bold text-[#f0f5f3]">
                Tek Dokunuşla Rol ve Kullanıcı Değiştir
              </h3>
              <p className="mt-1 mb-3.5 text-[11px] text-[#9aaead]">
                Farklı yetki profillerini (Sistem Yöneticisi, Restoran Yöneticisi,
                Garson) anında test etmek için aşağıdaki hazır hesaplara tıklayın:
              </p>

              <div className="space-y-2">
                {demoAccounts.map((acc) => {
                  const isCurrent = currentUser?.username === acc.username;
                  return (
                    <button
                      key={acc.username}
                      type="button"
                      onClick={() => handleQuickSwitchAccount(acc.username)}
                  disabled={false}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        isCurrent
                          ? "border-[#73d8c6] bg-[#244440] text-[#f4fffc]"
                          : "border-[#344647] bg-[#202f30] text-[#f0f5f3] hover:border-[#58b7a6]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold">{acc.label}</span>
                        <span className="rounded-full border border-[#3c6058] bg-[#192526] px-2 py-0.5 font-mono text-[10px] text-[#73d8c6]">
                          {acc.username}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-[#9aaead]">
                        <span>{acc.desc}</span>
                        <span className="font-bold text-[#efc97b]">
                          {isCurrent ? "✓ Aktif" : "Seç →"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-[#465353] bg-[#141f20] p-3 text-[11px] text-[#9aaead]">
              <div className="font-bold text-[#f0f5f3]">
                Aktif Oturum: {currentUser?.name || "Seçilmedi"}
              </div>
              <div className="mt-0.5">
                Kullanıcı Adı:{" "}
                <code className="text-[#73d8c6]">
                  {currentUser?.username || "—"}
                </code>{" "}
                · Rol:{" "}
                <code className="text-[#efc97b]">{currentUser?.role || "—"}</code>
              </div>
            </div>
          </div>
        </div>

        {/* Manager Password Reset Help Modal */}
        {showResetHelpModal && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-help-modal-title"
          >
            <div className="w-full max-w-md rounded-2xl border border-[#344647] bg-[#192526] p-6 shadow-2xl">
              <div className="text-[10px] font-extrabold tracking-widest text-[#efc97b] uppercase">
                KAPALI AĞ PAROLA SIFIRLAMA PROSEDÜRÜ
              </div>
              <h3
                id="reset-help-modal-title"
                className="mt-1 text-base font-bold text-[#f0f5f3]"
              >
                Parola veya PIN Unutulduğunda Ne Yapılır?
              </h3>
              <div className="mt-3 space-y-2.5 text-xs leading-relaxed text-[#c4cfcd]">
                <p>
                  1. Bu sistem <strong>tamamen kapalı yerel ağda (LAN)</strong>{" "}
                  çalıştığından e-posta veya SMS ile parola sıfırlama bağlantısı
                  gönderilmez.
                </p>
                <p>
                  2. Garson veya restoran yöneticisi parolasını unuttuğunda{" "}
                  <strong>Yerel Sistem Yöneticisi (SCR-16)</strong> ilgili kullanıcı
                  için tek kullanımlık geçici parola/PIN tanımlar ve mevcut açık
                  oturumları sonlandırır.
                </p>
                <p>
                  3. Kullanıcı ilk girişinde yeni kişisel parolasını belirlemek
                  zorundadır (<code>mustChangePassword = true</code>).
                </p>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowResetHelpModal(false)}
                  className="rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-4 py-2 text-xs font-extrabold text-[#10221f]"
                >
                  Anlaşıldı, Kapat
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // RENDER SCR-02: İLK KURULUM SİHİRBAZI
  // ============================================================================
  if (activeScreen === "SCR-02") {
    const steps = [
      {
        num: 1,
        title: "Restoran Bilgileri & Saat Dilimi",
        subtitle: "Europe/Istanbul yerel sunucu saati",
      },
      {
        num: 2,
        title: "Alanlar ve Masalar",
        subtitle: "Salon ve Teras masa yerleşimi",
      },
      {
        num: 3,
        title: "İlk Sistem Yöneticisi",
        subtitle: "Tek kullanımlık kurulum anahtarı",
      },
      {
        num: 4,
        title: "Menü ve Kategoriler Özeti",
        subtitle: "Fiyatsız ürün ağacı ve istasyonlar",
      },
      {
        num: 5,
        title: "Windows Yazdırma & Kontrol Listesi",
        subtitle: "Adisyon-USB / Mutfak-Windows",
      },
    ];

    const allChecked = Object.values(setupChecklist).every(Boolean);

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-extrabold tracking-[0.16em] text-[#73d8c6] uppercase">
              SCR-02 · İLK KURULUM SİHİRBAZI (YEREL SUNUCU)
            </div>
            <h1 className="mt-1 text-2xl font-bold text-[#f0f5f3]">
              Restoranı Yapılandır ve Devreye Al
            </h1>
            <p className="mt-1 text-xs text-[#9aaead]">
              Kurulum yerel sunucu-kasada (Tiwox TP-8610) internet veya PMS bağlantısı
              olmadan tamamlanır.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[#665637] bg-[#3b3325] px-3 py-1 text-xs font-bold text-[#f2d38f]">
              Adım {wizardStep} / 5
            </span>
            {config?.setupCompleted && (
              <span className="rounded-full border border-[#3c6058] bg-[#243d39] px-3 py-1 text-xs font-bold text-[#bdf0e4]">
                ✓ Kurulum Tamamlanmış
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left Wizard Stepper */}
          <div className="rounded-2xl border border-[#344647] bg-[#192526] p-3.5 lg:col-span-4">
            <div className="mb-2 px-2 text-[10px] font-extrabold tracking-widest text-[#9aaead] uppercase">
              KURULUM ADIMLARI
            </div>
            <div className="space-y-1.5">
              {steps.map((s) => {
                const isActive = wizardStep === s.num;
                const isDone = wizardStep > s.num;
                return (
                  <button
                    key={s.num}
                    type="button"
                    onClick={() => setWizardStep(s.num)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                      isActive
                        ? "border-[#58b7a6] bg-[#244640] text-[#dcfff6]"
                        : isDone
                        ? "border-[#2d4843] bg-[#182927] text-[#75cdbc]"
                        : "border-transparent bg-[#141f20] text-[#9aaead] hover:bg-[#1d2b2c]"
                    }`}
                  >
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-black ${
                        isActive
                          ? "bg-[#73d8c6] text-[#10221f]"
                          : isDone
                          ? "bg-[#2f5c53] text-[#bdf0e4]"
                          : "bg-[#263738] text-[#9aaead]"
                      }`}
                    >
                      {isDone ? "✓" : s.num}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold">{s.title}</div>
                      <div className="truncate text-[10px] opacity-80">
                        {s.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl border border-[#3c6259] bg-[#1c3531] p-3 text-[11px] text-[#c0eee5]">
              <strong>Kapalı LAN Kurulum Kuralı:</strong> Kurulum tamamlandıktan sonra
              tek kullanımlık kurulum anahtarı geçersiz kılınır; yeniden kurulum yalnız
              Sistem Yöneticisi doğrulamasıyla yapılabilir.
            </div>
          </div>

          {/* Right Active Step Content */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#344647] bg-[#192526] p-6 lg:col-span-8">
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div className="text-[10px] font-extrabold tracking-widest text-[#73d8c6] uppercase">
                  ADIM 1 · RESTORAN BİLGİLERİ VE SAAT DİLİMİ
                </div>
                <h2 className="text-lg font-bold text-[#f0f5f3]">
                  Yerel Restoran Kimliği ve Zaman Kaynağı
                </h2>
                <p className="text-xs text-[#9aaead]">
                  Tüm sipariş turları, zamanlı gönderimler ve denetim kayıtları istemci
                  cihaz saatine değil, sunucunun <code>Europe/Istanbul</code> saatine
                  göre damgalanır.
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[10px] font-extrabold text-[#aab9b6] uppercase">
                      RESTORAN GÖRÜNür ADI
                    </label>
                    <input
                      type="text"
                      value={setupRestaurantName}
                      onChange={(e) => setSetupRestaurantName(e.target.value)}
                      className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-extrabold text-[#aab9b6] uppercase">
                      YEREL KURULUM KODU
                    </label>
                    <input
                      type="text"
                      value={setupRestaurantCode}
                      onChange={(e) => setSetupRestaurantCode(e.target.value)}
                      className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 font-mono text-xs text-[#f0f5f3]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-extrabold text-[#aab9b6] uppercase">
                      SUNUCU SAAT DİLİMİ (ZORUNLU)
                    </label>
                    <select
                      value={setupTimezone}
                      onChange={(e) => setSetupTimezone(e.target.value)}
                      className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3]"
                    >
                      <option value="Europe/Istanbul">
                        Europe/Istanbul (UTC+03:00 · Türkiye Saati)
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-4">
                <div className="text-[10px] font-extrabold tracking-widest text-[#73d8c6] uppercase">
                  ADIM 2 · ALANLAR VE MASALAR
                </div>
                <h2 className="text-lg font-bold text-[#f0f5f3]">
                  Salon ve Teras Masa Yerleşimi
                </h2>
                <p className="text-xs text-[#9aaead]">
                  Bütün garsonlar tüm alanlardaki masaları görür. Masa kapasitesi görsel
                  referanstır; misafir (kuver) sayısını kısıtlamaz.
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#344647] bg-[#141f20] p-4">
                    <label className="mb-1 block text-[10px] font-extrabold text-[#73d8c6] uppercase">
                      SALON ALANI MASA SAYISI
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={setupSalonCount}
                      onChange={(e) =>
                        setSetupSalonCount(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-sm font-bold text-[#f0f5f3]"
                    />
                    <p className="mt-2 text-[11px] text-[#9aaead]">
                      Örn: Masa 01 .. Masa {String(setupSalonCount).padStart(2, "0")}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#344647] bg-[#141f20] p-4">
                    <label className="mb-1 block text-[10px] font-extrabold text-[#efc97b] uppercase">
                      TERAS ALANI MASA SAYISI
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={setupTerasCount}
                      onChange={(e) =>
                        setSetupTerasCount(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-sm font-bold text-[#f0f5f3]"
                    />
                    <p className="mt-2 text-[11px] text-[#9aaead]">
                      Toplam {setupSalonCount + setupTerasCount} masa tanımlanacak
                      (Mevcut veritabanında: {tables.length} masa, {areas.length} alan).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-4">
                <div className="text-[10px] font-extrabold tracking-widest text-[#73d8c6] uppercase">
                  ADIM 3 · İLK SİSTEM YÖNETİCİSİ VE KURULUM ANAHTARI
                </div>
                <h2 className="text-lg font-bold text-[#f0f5f3]">
                  Kişisel Yönetici Hesabı ve Tek Kullanımlık Kurulum Anahtarı
                </h2>
                <p className="text-xs text-[#9aaead]">
                  Varsayılan ortak şifre bırakılmaz. İlk yerel sistem yöneticisi tek
                  kullanımlık kurulum anahtarıyla doğrulanır.
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-extrabold text-[#aab9b6] uppercase">
                      YÖNETİCİ AD SOYAD
                    </label>
                    <input
                      type="text"
                      value={setupAdminName}
                      onChange={(e) => setSetupAdminName(e.target.value)}
                      className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-extrabold text-[#aab9b6] uppercase">
                      KULLANICI ADI
                    </label>
                    <input
                      type="text"
                      value={setupAdminUsername}
                      onChange={(e) => setSetupAdminUsername(e.target.value)}
                      className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 font-mono text-xs text-[#f0f5f3]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-extrabold text-[#aab9b6] uppercase">
                      YÖNETİCİ PAROLA / PIN
                    </label>
                    <input
                      type="password"
                      value={setupAdminPin}
                      onChange={(e) => setSetupAdminPin(e.target.value)}
                      className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-extrabold text-[#efc97b] uppercase">
                      TEK KULLANIMLIK KURULUM ANAHTARI
                    </label>
                    <input
                      type="text"
                      value={setupKeyInput}
                      onChange={(e) => setSetupKeyInput(e.target.value)}
                      className="w-full rounded-lg border border-[#705e37] bg-[#101a1a] px-3 py-2 font-mono text-xs text-[#f2d38f]"
                    />
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 4 && (
              <div className="space-y-4">
                <div className="text-[10px] font-extrabold tracking-widest text-[#73d8c6] uppercase">
                  ADIM 4 · MENÜ VE KATEGORİLER ÖZETİ (FİYATSIZ)
                </div>
                <h2 className="text-lg font-bold text-[#f0f5f3]">
                  Menü Ağacı, Mutfak İstasyonları ve Modifier Grupları
                </h2>
                <p className="text-xs text-[#9aaead]">
                  Sistemde fiyat, vergi veya ödeme alanı yoktur. Her ürün bir mutfak
                  istasyonuna (SICAK MUTFAK, SOĞUK / MEZE, IZGARA, TATLI / BAR)
                  yönlendirilir.
                </p>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-[#344647] bg-[#141f20] p-3.5">
                    <div className="text-[10px] text-[#9aaead]">KATEGORİLER</div>
                    <div className="mt-1 text-xl font-black text-[#73d8c6]">
                      {categories.length}
                    </div>
                    <div className="text-[10px] text-[#9aaead]">
                      {mainCategories.length} ana kategori
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#344647] bg-[#141f20] p-3.5">
                    <div className="text-[10px] text-[#9aaead]">AKTİF ÜRÜNLER</div>
                    <div className="mt-1 text-xl font-black text-[#f0f5f3]">
                      {menuItems.length}
                    </div>
                    <div className="text-[10px] text-[#73d8c6]">
                      Menü Sürümü v{config?.menuVersion ?? 1}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#344647] bg-[#141f20] p-3.5">
                    <div className="text-[10px] text-[#9aaead]">MODIFIER GRUBU</div>
                    <div className="mt-1 text-xl font-black text-[#efc97b]">
                      {modifierGroups.length}
                    </div>
                    <div className="text-[10px] text-[#9aaead]">
                      Zorunlu / İsteğe bağlı
                    </div>
                  </div>
                </div>

                <div className="max-h-48 overflow-auto rounded-xl border border-[#344647] bg-[#141f20] p-3">
                  <div className="mb-2 text-[10px] font-bold text-[#aab9b6] uppercase">
                    TANIMLI KATEGORİ VE ÜRÜN DAĞILIMI
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {categories.slice(0, 10).map((cat: any) => {
                      const count = menuItems.filter(
                        (m: any) => m.categoryId === cat.id
                      ).length;
                      return (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between rounded-lg border border-[#2a3939] bg-[#192526] px-3 py-1.5"
                        >
                          <span className="truncate font-semibold text-[#f0f5f3]">
                            {cat.parentId ? "↳ " : ""}
                            {cat.name}
                          </span>
                          <span className="rounded bg-[#243d39] px-2 py-0.5 text-[10px] font-bold text-[#73d8c6]">
                            {count} ürün
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 5 && (
              <div className="space-y-4">
                <div className="text-[10px] font-extrabold tracking-widest text-[#73d8c6] uppercase">
                  ADIM 5 · WINDOWS YAZDIRMA KUYRUKLARI VE KONTROL LİSTESİ
                </div>
                <h2 className="text-lg font-bold text-[#f0f5f3]">
                  Adisyon-USB / Mutfak-Windows ve Kurulum Sonrası Doğrulama
                </h2>
                <p className="text-xs text-[#9aaead]">
                  Uygulama doğrudan işletim sistemi yazdırma kuyruklarına (Windows
                  Spooler) iş bırakır; RAW/LPR/IPP seçimi işletim sistemi seviyesinde
                  yapılır.
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#344647] bg-[#141f20] p-3.5">
                    <label className="mb-1 block text-[10px] font-extrabold text-[#73d8c6] uppercase">
                      FİYATSIZ ADİSYON KUYRUĞU (USB)
                    </label>
                    <input
                      type="text"
                      value={setupReceiptQueue}
                      onChange={(e) => setSetupReceiptQueue(e.target.value)}
                      className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-1.5 font-mono text-xs text-[#f0f5f3]"
                    />
                    <div className="mt-1.5 text-[10px] text-[#9aaead]">
                      Epson TM-T20III (011) · Sunucu-kasaya doğrudan USB
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#344647] bg-[#141f20] p-3.5">
                    <label className="mb-1 block text-[10px] font-extrabold text-[#efc97b] uppercase">
                      MUTFAK SİPARİŞ / İPTAL KUYRUĞU (AĞ KÖPRÜSÜ)
                    </label>
                    <input
                      type="text"
                      value={setupKitchenQueue}
                      onChange={(e) => setSetupKitchenQueue(e.target.value)}
                      className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-1.5 font-mono text-xs text-[#f0f5f3]"
                    />
                    <div className="mt-1.5 text-[10px] text-[#9aaead]">
                      TM-T20III → DIGITUS DN-13003-2 → TP-Link TL-WA801N (Client/Bridge)
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[#344647] bg-[#141f20] p-3.5">
                  <div className="mb-2 text-[10px] font-extrabold tracking-wider text-[#aab9b6] uppercase">
                    KURULUM SONRASI ZORUNLU KONTROL LİSTESİ
                  </div>
                  <div className="space-y-2 text-xs">
                    {[
                      {
                        key: "lanIsolated",
                        label:
                          "TP-Link Archer AX23 WAN portu boş; otel ağı ve internet bağlantısı fiziksel olarak kapalı",
                      },
                      {
                        key: "biosAutoPower",
                        label:
                          "Tiwox TP-8610 (16 GB RAM / 256 GB SSD) BIOS 'Restore on AC Power Loss' otomatik açılış etkin",
                      },
                      {
                        key: "usbReceiptVerified",
                        label:
                          "Adisyon-USB kuyruğunda 80mm Türkçe karakter ve GS V kısmi kesim doğrulandı",
                      },
                      {
                        key: "bridgeApClientMode",
                        label:
                          "TP-Link TL-WA801N normal AP değil, açıkça Client/Bridge modunda DIGITUS DN-13003-2'ye bağlı",
                      },
                      {
                        key: "dualBackupConfigured",
                        label:
                          "USB (E:\\Alacarte\\Backups) ve Yerel Dizin (D:\\Alacarte\\Backups) 15 kopya döngüsel yedek hazır",
                      },
                    ].map((item) => (
                      <label
                        key={item.key}
                        className="flex cursor-pointer items-center gap-2.5 text-[#c4cfcd]"
                      >
                        <input
                          type="checkbox"
                          checked={!!setupChecklist[item.key]}
                          onChange={(e) =>
                            setSetupChecklist((prev) => ({
                              ...prev,
                              [item.key]: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#73d8c6]"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Wizard Footer Buttons */}
            <div className="mt-6 flex items-center justify-between border-t border-[#2d3d3d] pt-4">
              <button
                type="button"
                onClick={() => setWizardStep((s) => Math.max(1, s - 1))}
                disabled={wizardStep === 1}
                className="rounded-xl border border-[#344647] bg-[#202f30] px-4 py-2 text-xs font-bold text-[#f0f5f3] disabled:opacity-40"
              >
                ← Önceki Adım
              </button>

              {wizardStep < 5 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep((s) => Math.min(5, s + 1))}
                  className="rounded-xl border border-[#58b7a6] bg-[#73d8c6] px-5 py-2 text-xs font-extrabold text-[#10221f] hover:brightness-110"
                >
                  Kaydet ve Devam Et →
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!allChecked || busyAction === "wizard-complete"}
                  onClick={handleCompleteSetupWizard}
                  className="rounded-xl border border-[#58b7a6] bg-[#73d8c6] px-5 py-2.5 text-xs font-extrabold text-[#10221f] hover:brightness-110 disabled:opacity-45"
                >
                  {busyAction === "wizard-complete"
                    ? "Kurulum Kaydediliyor..."
                    : "Kurulumu Tamamla ve Masa Planına Geç ✓"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER SCR-03: MASA PLANI VE MASA LİSTESİ
  // ============================================================================
  if (activeScreen === "SCR-03") {
    const activeTablesList = tables.filter((t: any) => t.active !== false);
    const totalCount = activeTablesList.length;
    const inServiceCount = activeTablesList.filter(
      (t: any) => t.status !== "EMPTY"
    ).length;
    const draftOrScheduledCount = activeTablesList.filter(
      (t: any) =>
        t.status === "DRAFT_PENDING" || t.status === "SCHEDULED_PENDING"
    ).length;
    const decisionPendingCount = activeTablesList.filter(
      (t: any) =>
        t.status === "CANCEL_PENDING" || t.status === "PRINT_WARNING"
    ).length;

    const areaTabs = [
      "TÜMÜ",
      ...Array.from(
        new Set([
          "Salon",
          "Teras",
          ...areas.map((a: any) => a.name).filter(Boolean),
        ])
      ),
    ];

    const statusChips = [
      { id: "TÜMÜ", label: "Tümü" },
      { id: "EMPTY", label: "○ Boş" },
      { id: "IN_SERVICE", label: "● Serviste" },
      { id: "DRAFT_PENDING", label: "✎ Taslak Var" },
      { id: "SCHEDULED_PENDING", label: "⏱ Zamanlandı/Bekliyor" },
      { id: "PRINT_WARNING", label: "⚠ Baskı Uyarısı" },
      { id: "CANCEL_PENDING", label: "⊘ İptal Bekliyor" },
    ];

    const filteredTables = activeTablesList.filter((t: any) => {
      const areaName =
        t.area?.name ||
        areas.find((a: any) => a.id === t.areaId)?.name ||
        (t.number % 3 === 0 ? "Teras" : "Salon");
      const areaMatch =
        areaFilter === "TÜMÜ" ||
        areaName.toLocaleLowerCase("tr-TR") ===
          areaFilter.toLocaleLowerCase("tr-TR");
      const statusMatch =
        statusFilter === "TÜMÜ" || t.status === statusFilter;
      const q = tableSearch.trim().toLocaleLowerCase("tr-TR");
      const searchMatch =
        !q ||
        t.name?.toLocaleLowerCase("tr-TR").includes(q) ||
        String(t.number).includes(q) ||
        areaName.toLocaleLowerCase("tr-TR").includes(q);
      return areaMatch && statusMatch && searchMatch;
    });

    const selectedMeta =
      TABLE_STATUS_META[activeTable?.status || "EMPTY"] ||
      TABLE_STATUS_META.EMPTY;

    const selectedTableAreaName =
      activeTable?.area?.name ||
      areas.find((a: any) => a.id === activeTable?.areaId)?.name ||
      "Salon";

    return (
      <div className="space-y-4">
        {/* Top Screen Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-extrabold tracking-[0.16em] text-[#73d8c6] uppercase">
              SCR-03 · MASA PLANI VE MASA LİSTESİ
            </div>
            <h1 className="mt-1 text-2xl font-bold text-[#f0f5f3]">
              Masa ve Servis Durumu
            </h1>
            <p className="mt-1 text-xs text-[#9aaead]">
              Tüm garsonlar bütün masaları görür. Bir masayı seçerek açık siparişe
              dönün veya yeni servis başlatın.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-[#344647] bg-[#141f20] px-3 py-1.5 text-[11px] text-[#9aaead]">
              Son Eşitleme:{" "}
              <strong className="text-[#73d8c6]">
                {formatIstanbulTime(new Date())}
              </strong>{" "}
              · Menü Sürümü:{" "}
              <strong className="text-[#f0f5f3]">
                v{config?.menuVersion ?? 1}
              </strong>
            </span>
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-xl border border-[#344647] bg-[#202f30] px-3.5 py-2 text-xs font-bold text-[#f0f5f3] hover:border-[#73d8c6]"
            >
              ↻ Durumu Yenile
            </button>
            {activeTable && (
              <button
                type="button"
                onClick={() => handleOpenOrResumeTable(activeTable)}
                className="rounded-xl border border-[#58b7a6] bg-[#73d8c6] px-4 py-2 text-xs font-extrabold text-[#10221f] hover:brightness-110"
              >
                {activeSession
                  ? `Açık Siparişe Dön (${activeTable.name}) →`
                  : `＋ Yeni Servis Başlat (${activeTable.name})`}
              </button>
            )}
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-[#344647] bg-[#192526] p-3.5">
            <div className="text-[10px] font-bold tracking-wider text-[#9aaead] uppercase">
              TOPLAM MASA
            </div>
            <strong className="mt-1 block text-2xl font-black tabular-nums text-[#f0f5f3]">
              {totalCount}
            </strong>
            <small className="text-[10px] text-[#73d8c6]">
              Salon ve Teras aktif masalar
            </small>
          </div>
          <div className="rounded-xl border border-[#344647] bg-[#192526] p-3.5">
            <div className="text-[10px] font-bold tracking-wider text-[#9aaead] uppercase">
              SERVİSTE
            </div>
            <strong className="mt-1 block text-2xl font-black tabular-nums text-[#73d8c6]">
              {inServiceCount}
            </strong>
            <small className="text-[10px] text-[#9aaead]">
              Açık servis oturumu bulunan
            </small>
          </div>
          <div className="rounded-xl border border-[#344647] bg-[#192526] p-3.5">
            <div className="text-[10px] font-bold tracking-wider text-[#9aaead] uppercase">
              TASLAK / GÖNDERİM BEKLEYEN
            </div>
            <strong className="mt-1 block text-2xl font-black tabular-nums text-[#efc97b]">
              {draftOrScheduledCount}
            </strong>
            <small className="text-[10px] text-[#efc97b]">
              Mutfağa iletilecek / zamanlı
            </small>
          </div>
          <div className="rounded-xl border border-[#344647] bg-[#192526] p-3.5">
            <div className="text-[10px] font-bold tracking-wider text-[#9aaead] uppercase">
              İPTAL / BASKI KARARI BEKLEYEN
            </div>
            <strong className="mt-1 block text-2xl font-black tabular-nums text-[#f18d83]">
              {decisionPendingCount}
            </strong>
            <small className="text-[10px] text-[#f18d83]">
              Yönetici incelemesi gereken
            </small>
          </div>
        </div>

        {/* Main Two-Column Floor Layout */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left: Table Filter & Grid */}
          <div className="overflow-hidden rounded-2xl border border-[#344647] bg-[#192526] lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#344647] px-4 py-3">
              <div>
                <b className="text-xs text-[#f0f5f3]">Restoran Masa Planı</b>
                <small className="ml-2 text-[10px] text-[#9aaead]">
                  Alan · Operasyon Durumu · Açık Sipariş Referansı
                </small>
              </div>
              <span className="text-[10px] text-[#9aaead]">
                Gösterilen: <strong>{filteredTables.length}</strong> / {totalCount} masa
              </span>
            </div>

            {/* Toolbar: Search + Area Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-[#344647] bg-[#152021] px-3.5 py-2.5">
              <input
                type="search"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Masa no, ad veya alan ara..."
                className="w-full max-w-[230px] rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-1.5 text-xs text-[#f0f5f3] focus:border-[#73d8c6] focus:outline-none"
              />
              <div className="flex flex-wrap gap-1">
                {areaTabs.map((areaName) => {
                  const active = areaFilter === areaName;
                  return (
                    <button
                      key={areaName}
                      type="button"
                      onClick={() => setAreaFilter(areaName)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        active
                          ? "border border-[#58b7a6] bg-[#244440] text-[#73d8c6]"
                          : "border border-transparent bg-[#202f30] text-[#9aaead] hover:text-[#f0f5f3]"
                      }`}
                    >
                      {areaName === "TÜMÜ" ? "Tüm Alanlar" : areaName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Operational Status Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-[#344647] bg-[#131d1e] px-3.5 py-2">
              {statusChips.map((chip) => {
                const active = statusFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setStatusFilter(chip.id)}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition ${
                      active
                        ? "border-[#73d8c6] bg-[#244440] text-[#dcfff6]"
                        : "border-[#344647] bg-[#192526] text-[#9aaead] hover:border-[#58b7a6]"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* Table Tiles Grid */}
            <div className="grid grid-cols-2 gap-2.5 p-3.5 sm:grid-cols-3 md:grid-cols-4">
              {filteredTables.map((table: any) => {
                const meta =
                  TABLE_STATUS_META[table.status] || TABLE_STATUS_META.EMPTY;
                const isSelected = activeTable?.id === table.id;
                const areaName =
                  table.area?.name ||
                  areas.find((a: any) => a.id === table.areaId)?.name ||
                  (table.number % 3 === 0 ? "Teras" : "Salon");
                const tableOpenSession =
                  sessions.find(
                    (s: any) => s.tableId === table.id && s.status === "OPEN"
                  ) ||
                  (table.sessions || []).find((s: any) => s.status === "OPEN");

                return (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => onSelectTable(table.id)}
                    onDoubleClick={() => handleOpenOrResumeTable(table)}
                    className={`group relative flex min-h-[112px] flex-col justify-between rounded-xl border p-3 text-left transition ${
                      meta.tileBorder
                    } ${
                      isSelected
                        ? "ring-2 ring-[#73d8c6] border-transparent"
                        : "hover:border-[#6ebead]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: meta.dotColor }}
                        />
                        <span className="text-base font-black tracking-tight text-[#f0f5f3]">
                          {String(table.number || table.name).padStart(2, "0")}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${meta.badgeClass}`}
                      >
                        <span>{meta.icon}</span>
                        <span>{meta.label}</span>
                      </span>
                    </div>

                    <div className="my-1">
                      <div className="text-xs font-bold text-[#f0f5f3]">
                        {table.name}
                      </div>
                      <div className="text-[10px] text-[#9aaead]">
                        {areaName} · Kapasite {table.capacity || 4}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/10 pt-1.5 text-[10px]">
                      {tableOpenSession ? (
                        <>
                          <span className="font-semibold text-[#73d8c6]">
                            {tableOpenSession.guestCount} misafir ·{" "}
                            {tableOpenSession.openedBy?.name?.split(" ")[0] ||
                              "Açık"}
                          </span>
                          <span className="font-mono text-[9px] text-[#aab9b6]">
                            {tableOpenSession.referenceCode}
                          </span>
                        </>
                      ) : (
                        <span className="text-[#9aaead]">Yeni servise hazır</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Selected Table Inspector Panel */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#344647] bg-[#192526] lg:col-span-4">
            <div>
              <div className="flex items-center justify-between border-b border-[#344647] px-4 py-3">
                <b className="text-xs text-[#f0f5f3]">Seçili Masa Ayrıntısı</b>
                {activeTable && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${selectedMeta.badgeClass}`}
                  >
                    <span>{selectedMeta.icon}</span>
                    <span>
                      {activeTable.name} · {selectedMeta.label}
                    </span>
                  </span>
                )}
              </div>

              {activeTable ? (
                <div className="space-y-4 p-4">
                  <div>
                    <h2 className="text-lg font-black text-[#f0f5f3]">
                      {activeTable.name} ({selectedTableAreaName})
                    </h2>
                    <p className="mt-1 text-xs text-[#9aaead]">
                      {activeSession ? (
                        <>
                          Sipariş Ref:{" "}
                          <strong className="font-mono text-[#73d8c6]">
                            {activeSession.referenceCode}
                          </strong>{" "}
                          · {activeSession.guestCount} Misafir /{" "}
                          {activeSession.seatCount} Koltuk · Açılış:{" "}
                          {formatIstanbulTime(activeSession.openedAt)} (
                          {activeSession.openedBy?.name || "Garson"})
                        </>
                      ) : (
                        `Bu masada şu an açık servis yok. Kapasite notu: ${
                          activeTable.capacity || 4
                        } kişilik.`
                      )}
                    </p>
                  </div>

                  {activeSession ? (
                    <div className="rounded-xl border border-[#705e37] bg-[#393321] p-3 text-xs text-[#f1db9f]">
                      Açık servis seçildiğinde mükerrer yeni sipariş açılmaz;{" "}
                      <strong>{activeSession.referenceCode}</strong> referanslı
                      servis oturumuna kaldığı yerden devam edilir.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[#344647] bg-[#141f20] p-3">
                      <label className="mb-1.5 block text-[10px] font-extrabold text-[#aab9b6] uppercase">
                        BAŞLANGIÇ MİSAFİR (KUVER) SAYISI
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setNewServiceGuests((g) => Math.max(1, g - 1))
                          }
                          className="h-8 w-8 rounded-lg border border-[#344647] bg-[#202f30] text-sm font-bold"
                        >
                          −
                        </button>
                        <strong className="min-w-[36px] text-center text-base font-black text-[#73d8c6]">
                          {newServiceGuests}
                        </strong>
                        <button
                          type="button"
                          onClick={() =>
                            setNewServiceGuests((g) => Math.min(99, g + 1))
                          }
                          className="h-8 w-8 rounded-lg border border-[#344647] bg-[#202f30] text-sm font-bold"
                        >
                          ＋
                        </button>
                        <span className="ml-2 text-[11px] text-[#9aaead]">
                          misafir ile servis aç
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyAction === `open-table-${activeTable.id}`}
                      onClick={() => handleOpenOrResumeTable(activeTable)}
                      className="flex-1 rounded-xl border border-[#58b7a6] bg-[#73d8c6] px-4 py-2.5 text-xs font-extrabold text-[#10221f] hover:brightness-110 disabled:opacity-50"
                    >
                      {activeSession
                        ? "Açık Siparişe Dön (SCR-04) →"
                        : "＋ Yeni Servis Başlat (SCR-04) →"}
                    </button>
                    {activeSession && (
                      <button
                        type="button"
                        onClick={() => onNavigate("SCR-08")}
                        className="rounded-xl border border-[#344647] bg-[#202f30] px-3 py-2.5 text-xs font-bold text-[#f0f5f3] hover:border-[#73d8c6]"
                      >
                        Masa Ayrıntısı (SCR-08)
                      </button>
                    )}
                  </div>

                  {/* MICROS Table Management Quick Actions */}
                  {activeSession && (
                    <div className="grid grid-cols-3 gap-2 w-full pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setTransferTargetTableId("");
                          setShowTransferModal(true);
                        }}
                        className="rounded-xl border border-[#3b5953] bg-[#1d3531] p-2 text-center text-[10px] font-extrabold text-[#9ee5d7] hover:brightness-110"
                        title="Bu masanın açık siparişini boş bir masaya taşı"
                      >
                        <span className="block text-sm">⇄</span>
                        Masa Taşı
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMergeTargetTableId("");
                          setShowMergeModal(true);
                        }}
                        className="rounded-xl border border-[#6b5837] bg-[#3a301d] p-2 text-center text-[10px] font-extrabold text-[#f3d999] hover:brightness-110"
                        title="Bu masayı başka bir açık masa ile birleştir"
                      >
                        <span className="block text-sm">⇶</span>
                        Birleştir
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTransferTargetWaiterId("");
                          setShowWaiterTransferModal(true);
                        }}
                        className="rounded-xl border border-[#48536b] bg-[#222a3d] p-2 text-center text-[10px] font-extrabold text-[#a9bde8] hover:brightness-110"
                        title="Masa sorumluluğunu başka bir personele devret"
                      >
                        <span className="block text-sm">👤</span>
                        Garson Devir
                      </button>
                    </div>
                  )}

                  {/* Recent Activity on Selected Table */}
                  <div className="rounded-xl border border-[#344647] bg-[#141f20] overflow-hidden">
                    <div className="flex items-center justify-between border-b border-[#2d3d3d] px-3.5 py-2.5">
                      <b className="text-[11px] text-[#f0f5f3]">
                        Son Kalemler ve Hareketler
                      </b>
                      <small className="text-[10px] text-[#9aaead]">
                        Europe/Istanbul
                      </small>
                    </div>
                    {allSessionItems.length > 0 ? (
                      <div className="divide-y divide-[#253434] max-h-56 overflow-auto">
                        {allSessionItems.slice(0, 6).map((item: any) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-bold text-[#f0f5f3]">
                                {item.quantity} × {item.productNameSnapshot}
                              </div>
                              <div className="truncate text-[10px] text-[#9aaead]">
                                {item.stationNameSnapshot} · Koltuk{" "}
                                {item.seatNumber || "—"}
                                {item.kitchenNote ? ` · Not: ${item.kitchenNote}` : ""}
                              </div>
                            </div>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${
                                item.status === "SENT"
                                  ? "border-[#3c6058] bg-[#243d39] text-[#bdf0e4]"
                                  : item.status === "CANCEL_REQUESTED" ||
                                    item.status === "CANCELLED"
                                  ? "border-[#684442] bg-[#3e2c2b] text-[#ffc0b5]"
                                  : "border-[#665637] bg-[#3b3325] text-[#f2d38f]"
                              }`}
                            >
                              {item.status === "SENT"
                                ? "Gönderildi"
                                : item.status === "DRAFT"
                                ? "Taslak"
                                : item.status === "HELD"
                                ? "Bekletildi"
                                : item.status === "SCHEDULED"
                                ? "Zamanlandı"
                                : item.status === "CANCEL_REQUESTED"
                                ? "İptal Bekliyor"
                                : "İptal"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-xs text-[#9aaead]">
                        Bu masada henüz kayıtlı sipariş kalemi bulunmuyor.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-[#9aaead]">
                  Sol plandan bir masa seçin.
                </div>
              )}
            </div>

            <div className="border-t border-[#344647] bg-[#141f20] px-4 py-3 text-[11px] text-[#9aaead]">
              Fiyat, ara toplam, ödeme veya PMS alanı gösterilmez.
            </div>
          </div>
        </div>
        {renderMicrosModals()}
      </div>
    );
  }

  // ============================================================================
  // RENDER SCR-04: SİPARİŞ / İŞLEM EKRANI (MICROS SIMPHONY TSR REFERANSLI)
  // ============================================================================
  if (activeScreen === "SCR-04") {
    const guestCount = activeSession?.guestCount ?? 2;
    const seatCount = Math.max(activeSession?.seatCount ?? 2, activeSeatNumber);
    const rounds = activeSession?.rounds || [];
    const currentRoundNumber =
      rounds.length > 0
        ? Math.max(...rounds.map((r: any) => r.roundNumber || 1))
        : 1;

    // Filter products for center menu board
    const activeMenuItems = menuItems.filter(
      (m: any) => m.active !== false && m.status !== "PASSIVE"
    );

    const displayedProducts = activeMenuItems.filter((item: any) => {
      const q = productSearch.trim().toLocaleLowerCase("tr-TR");
      if (q) {
        return (
          item.name?.toLocaleLowerCase("tr-TR").includes(q) ||
          item.receiptName?.toLocaleLowerCase("tr-TR").includes(q) ||
          item.allergens?.toLocaleLowerCase("tr-TR").includes(q)
        );
      }
      if (selectedSubCategoryId) {
        return item.categoryId === selectedSubCategoryId;
      }
      if (selectedMainCategoryId) {
        const subIds = subCategories.map((sc: any) => sc.id);
        return (
          item.categoryId === selectedMainCategoryId ||
          subIds.includes(item.categoryId)
        );
      }
      return true;
    });

    const draftCount = allSessionItems.filter(
      (it: any) => it.status === "DRAFT"
    ).length;

    const currentGuideStep =
      LEARNING_GUIDE_STEPS[guideStepIndex] || LEARNING_GUIDE_STEPS[0];

    return (
      <div className="space-y-3">
        {/* Top Title & Quick Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-extrabold tracking-[0.16em] text-[#73d8c6] uppercase">
              SCR-04 · SİPARİŞ / İŞLEM EKRANI (MICROS SIMPHONY TSR REFERANSLI)
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-[#f0f5f3]">
                {activeTable?.name || "Masa Seçilmedi"}
              </h1>
              <span className="rounded-full border border-[#3c6058] bg-[#243d39] px-2.5 py-0.5 font-mono text-xs font-bold text-[#bdf0e4]">
                {activeSession?.referenceCode || "YENİ SERVİS"}
              </span>
              <span className="rounded-full border border-[#465353] bg-[#202f30] px-2.5 py-0.5 text-[11px] text-[#c4cfcd]">
                Tur {currentRoundNumber} · Masa Servisi
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {config?.learningModeEnabled && (
              <button
                type="button"
                onClick={() => setShowContextualHints((v) => !v)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                  showContextualHints
                    ? "border-[#efc97b] bg-[#393321] text-[#f2d38f]"
                    : "border-[#344647] bg-[#202f30] text-[#9aaead]"
                }`}
              >
                {showContextualHints
                  ? "★ Yardım / Bağlamsal İpuçları: Açık"
                  : "☆ Yardım / Bağlamsal İpuçları: Gizli"}
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate("SCR-03")}
              className="rounded-xl border border-[#344647] bg-[#202f30] px-3 py-1.5 text-xs font-bold text-[#f0f5f3] hover:border-[#73d8c6]"
            >
              ← Masalara Dön (SCR-03)
            </button>
            <button
              type="button"
              onClick={() => onNavigate("SCR-05")}
              className="rounded-xl border border-[#344647] bg-[#202f30] px-3 py-1.5 text-xs font-bold text-[#f0f5f3] hover:border-[#73d8c6]"
            >
              Kalem Seçenekleri (SCR-05)
            </button>
          </div>
        </div>

        {/* Interactive 7-step Waiter Learning Mode Banner (§5.17) when config.learningModeEnabled is true */}
        {config?.learningModeEnabled && guideOpen && (
          <div className="rounded-2xl border border-[#705e37] bg-gradient-to-r from-[#2e291b] via-[#222c2b] to-[#1b2927] p-3.5 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-[#efc97b] bg-[#3b3325] px-2.5 py-0.5 text-[10px] font-black text-[#f2d38f]">
                  ADIM ADIM SİPARİŞ REHBERİ · {currentGuideStep.step} /{" "}
                  {LEARNING_GUIDE_STEPS.length}
                </span>
                <strong className="text-xs font-extrabold text-[#f0f5f3]">
                  {currentGuideStep.title}
                </strong>
                {guidePaused && (
                  <span className="rounded bg-[#3e2c2b] px-2 py-0.5 text-[10px] font-bold text-[#ffc0b5]">
                    Duraklatıldı
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setGuideStepIndex((i) => Math.max(0, i - 1))
                  }
                  disabled={guideStepIndex === 0}
                  className="rounded-lg border border-[#4d5c5b] bg-[#202f30] px-2.5 py-1 text-[11px] font-bold text-[#f0f5f3] disabled:opacity-40"
                >
                  ← Önceki
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setGuideStepIndex((i) =>
                      Math.min(LEARNING_GUIDE_STEPS.length - 1, i + 1)
                    )
                  }
                  disabled={guideStepIndex === LEARNING_GUIDE_STEPS.length - 1}
                  className="rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-2.5 py-1 text-[11px] font-extrabold text-[#10221f] disabled:opacity-40"
                >
                  Sonraki →
                </button>
                <button
                  type="button"
                  onClick={() => setGuidePaused((p) => !p)}
                  className="rounded-lg border border-[#665637] bg-[#3b3325] px-2.5 py-1 text-[11px] font-bold text-[#f2d38f]"
                >
                  {guidePaused ? "Devam Et" : "Duraklat"}
                </button>
                <button
                  type="button"
                  onClick={() => setGuideOpen(false)}
                  className="rounded-lg border border-[#4d5c5b] bg-[#192526] px-2.5 py-1 text-[11px] font-bold text-[#9aaead] hover:text-[#f0f5f3]"
                >
                  Kapat ✕
                </button>
              </div>
            </div>
            {!guidePaused && (
              <p className="mt-2 text-xs leading-relaxed text-[#d9e5e3]">
                {currentGuideStep.detail}{" "}
                <span className="text-[11px] text-[#efc97b]">
                  (Rehber öğretici moddur; garson adına otomatik sipariş verisi
                  değiştirmez.)
                </span>
              </p>
            )}
          </div>
        )}

        {/* MICROS Simphony TSR Container */}
        <div className="overflow-hidden rounded-2xl border border-[#4c5c5b] bg-[#354243] shadow-2xl">
          {/* Top TSR Control Bar */}
          <div className="grid grid-cols-2 gap-1 bg-[#455352] p-1.5 sm:grid-cols-3 lg:grid-cols-7">
            {/* 1. Product Search */}
            <div className="flex items-center gap-1.5 rounded bg-[#202c2d] px-2.5 py-1.5">
              <span className="text-xs text-[#73d8c6]">⌕</span>
              <input
                type="search"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Ürün / alerjen ara..."
                className="w-full bg-transparent text-xs text-[#f0f5f3] placeholder-[#9aaead] focus:outline-none"
              />
            </div>

            {/* 2. Guest/Kuver Stepper */}
            <div className="flex items-center justify-between rounded bg-[#202c2d] px-2.5 py-1.5 text-xs">
              <span className="font-bold text-[#9aaead]">Kuver:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateGuestSeat(guestCount - 1, seatCount)
                  }
                  className="h-6 w-6 rounded border border-[#596c69] bg-[#354544] font-bold text-[#f0f5f3]"
                >
                  −
                </button>
                <strong className="min-w-[20px] text-center font-black text-[#f0f5f3]">
                  {guestCount}
                </strong>
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateGuestSeat(guestCount + 1, seatCount)
                  }
                  className="h-6 w-6 rounded border border-[#596c69] bg-[#354544] font-bold text-[#f0f5f3]"
                >
                  +
                </button>
              </div>
            </div>

            {/* 3. Seat Selector (Koltuk 1..N + '+ Koltuk') */}
            <div className="flex items-center justify-between gap-1 rounded bg-[#202c2d] px-2 py-1.5 text-xs sm:col-span-2">
              <div className="flex flex-wrap items-center gap-1">
                {Array.from({ length: Math.min(seatCount, 6) }, (_, i) => i + 1).map(
                  (sNum) => (
                    <button
                      key={sNum}
                      type="button"
                      onClick={() => setActiveSeatNumber(sNum)}
                      className={`rounded px-2 py-0.5 text-[11px] font-extrabold transition ${
                        activeSeatNumber === sNum
                          ? "bg-[#73d8c6] text-[#10221f]"
                          : "bg-[#354544] text-[#c4cfcd] hover:text-white"
                      }`}
                    >
                      K{sNum}
                    </button>
                  )
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextSeat = seatCount + 1;
                  setActiveSeatNumber(nextSeat);
                  handleUpdateGuestSeat(guestCount, nextSeat);
                }}
                className="shrink-0 rounded border border-[#58b7a6] bg-[#244440] px-2 py-0.5 text-[10px] font-extrabold text-[#73d8c6]"
              >
                + Koltuk
              </button>
            </div>

            {/* 4. Service Type & Round */}
            <div className="flex items-center justify-center gap-1.5 rounded bg-[#202c2d] px-2 py-1.5 text-[11px]">
              <span className="font-bold text-[#73d8c6]">Masa Servisi</span>
              <span className="text-[#9aaead]">·</span>
              <strong className="text-[#f0f5f3]">Tur {currentRoundNumber}</strong>
            </div>

            {/* 5. Waiter Badge with Shift/Transfer Trigger */}
            <button
              type="button"
              onClick={() => {
                setTransferTargetWaiterId("");
                setShowWaiterTransferModal(true);
              }}
              className="flex items-center justify-center gap-1.5 rounded bg-[#202c2d] px-2 py-1.5 text-[11px] hover:bg-[#2d3a3a] transition border border-[#3c4e4c]"
              title="Masa sorumlusu garsonu değiştir (Transfer Check)"
            >
              <span className="text-[#9aaead]">Garson:</span>
              <strong className="truncate text-[#f0f5f3]">
                {activeSession?.openedBy?.name?.split(" ")[0] || currentUser?.name?.split(" ")[0] || "Garson"}
              </strong>
              <span className="text-[10px] text-[#73d8c6]">⇄</span>
            </button>

            {/* 6. Hold Current Round Toggle */}
            <button
              type="button"
              onClick={() => setHoldThisRoundToggle((v) => !v)}
              className={`flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[10px] font-extrabold transition ${
                holdThisRoundToggle
                  ? "border border-[#efc97b] bg-[#433820] text-[#ffe0a2]"
                  : "bg-[#202c2d] text-[#9aaead] hover:text-[#f0f5f3]"
              }`}
            >
              <span>{holdThisRoundToggle ? "⏸" : "▶"}</span>
              <span>Bu turu beklet</span>
            </button>

            {/* 7. MICROS Rush Order Toggle */}
            <button
              type="button"
              onClick={handleToggleRoundRush}
              className={`flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[10px] font-black transition ${
                roundRushActive
                  ? "border border-[#f18d83] bg-[#532624] text-[#ffc4bc] animate-pulse"
                  : "bg-[#202c2d] text-[#9aaead] hover:text-[#f0f5f3]"
              }`}
              title="Bu turu mutfağa ACİL / ÖNCELİKLİ (RUSH) olarak gönder"
            >
              <span>⚡</span>
              <span>{roundRushActive ? "RUSH (ACİL: AÇIK)" : "RUSH (ACİL)"}</span>
            </button>

            {/* 8. MICROS 86 / Item Availability Modal Trigger */}
            <button
              type="button"
              onClick={() => setShow86Modal(true)}
              className="flex items-center justify-center gap-1.5 rounded bg-[#202c2d] px-2 py-1.5 text-[10px] font-black text-[#efc97b] hover:bg-[#2d3a3a] transition border border-[#6b5837]"
              title="Tükenen ürünleri (86) ve kalan porsiyon sayacını yönet"
            >
              <span>🚫</span>
              <span>86 / Stok</span>
            </button>
          </div>

          {/* 3-Column POS Workspace: Check Pane | Menu Board | Action Strip */}
          <div className="grid min-h-[540px] grid-cols-1 gap-[2px] bg-[#354243] lg:grid-cols-12">
            {/* LEFT CHECK PANE (col-span-4) */}
            <div className="flex flex-col justify-between bg-[#1b2728] lg:col-span-4">
              {/* Check Header */}
              <div className="border-b border-[#344647] bg-[#162122] p-3">
                <div className="flex items-center justify-between">
                  <strong className="text-sm font-black text-[#f0f5f3]">
                    {activeTable?.name?.toUpperCase() || "MASA"} ·{" "}
                    <span className="font-mono text-[#73d8c6]">
                      {activeSession?.referenceCode || "A-2026-YENİ"}
                    </span>
                  </strong>
                  <span className="rounded bg-[#243d39] px-2 py-0.5 text-[10px] font-bold text-[#bdf0e4]">
                    Koltuk {activeSeatNumber} Seçili
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-[#9aaead]">
                  Açılış: {formatIstanbulTime(activeSession?.openedAt)} · Garson:{" "}
                  {activeSession?.openedBy?.name || currentUser?.name}
                </div>
              </div>

              {/* Check Lines List */}
              <div className="flex-1 divide-y divide-[#2b3b3b] overflow-y-auto p-2">
                {allSessionItems.length === 0 ? (
                  <div className="flex h-48 flex-col items-center justify-center p-4 text-center text-xs text-[#9aaead]">
                    <p className="font-bold text-[#c4cfcd]">
                      Adisyonda henüz ürün kalemi yok.
                    </p>
                    <p className="mt-1 text-[11px]">
                      Orta menü panosundan bir ürüne dokunarak Koltuk{" "}
                      {activeSeatNumber} için ekleyin.
                    </p>
                  </div>
                ) : (
                  allSessionItems.map((item: any) => {
                    const isSelected = selectedOrderItem?.id === item.id;
                    const itemRound = rounds.find(
                      (r: any) => r.id === item.roundId
                    );
                    const roundNum = itemRound?.roundNumber || 1;
                    const mods = safeParseJsonArray<any>(item.modifiersJson).map(
                      (m: any) => (typeof m === "string" ? m : m?.name || "")
                    );
                    const shared = safeParseJsonArray<number>(
                      item.sharedSeatsJson
                    );

                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedOrderItemId(item.id)}
                        className={`cursor-pointer rounded-lg p-2.5 transition ${
                          isSelected
                            ? "bg-[#254542] ring-1 ring-[#73d8c6]"
                            : item.status === "DRAFT"
                            ? "bg-[#1f3130] hover:bg-[#243937]"
                            : "hover:bg-[#202f30]"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#324341] text-xs font-black text-[#f0f5f3]">
                            {item.quantity}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className={`text-xs font-extrabold ${
                                  item.status === "CANCELLED"
                                    ? "line-through text-[#9aaead]"
                                    : "text-[#f0f5f3]"
                                }`}
                              >
                                {item.receiptNameSnapshot ||
                                  item.productNameSnapshot}
                              </span>
                              {/* Status Badge */}
                              {item.status === "SENT" && (
                                <span className="rounded bg-[#243d39] px-1.5 py-0.5 text-[9px] font-extrabold text-[#73d8c6]">
                                  ✓ / Tur {roundNum}
                                </span>
                              )}
                              {item.status === "DRAFT" && (
                                <span className="rounded bg-[#3b3325] px-1.5 py-0.5 text-[9px] font-extrabold text-[#efc97b]">
                                  TASLAK · Tur {roundNum}
                                </span>
                              )}
                              {item.status === "HELD" && (
                                <span className="rounded bg-[#433820] px-1.5 py-0.5 text-[9px] font-extrabold text-[#ffe0a2]">
                                  BEKLETİLDİ
                                </span>
                              )}
                              {(item.status === "SCHEDULED" ||
                                item.status === "OVERDUE") && (
                                <span className="rounded bg-[#233544] px-1.5 py-0.5 text-[9px] font-extrabold text-[#8dc4e9]">
                                  ZAMANLANDI{" "}
                                  {item.scheduledAt
                                    ? formatIstanbulTime(item.scheduledAt)
                                    : ""}
                                </span>
                              )}
                              {item.status === "CANCEL_REQUESTED" && (
                                <span className="rounded bg-[#3e2c2b] px-1.5 py-0.5 text-[9px] font-extrabold text-[#ffc0b5]">
                                  İPTAL BEKLİYOR
                                </span>
                              )}
                              {item.status === "CANCELLED" && (
                                <span className="rounded bg-[#3e2c2b] px-1.5 py-0.5 text-[9px] font-extrabold text-[#f18d83]">
                                  İPTAL
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-[#9eddd1]">
                              <span>{item.stationNameSnapshot}</span>
                              <span>·</span>
                              <span>
                                Koltuk {item.seatNumber || "Atanmamış"}
                              </span>
                              {shared.length > 0 && (
                                <span className="rounded bg-[#244440] px-1.5 py-0.2 text-[9px] font-bold text-[#73d8c6]">
                                  Paylaşım: Koltuk [{shared.join(", ")}]
                                </span>
                              )}
                            </div>

                            {mods.length > 0 && (
                              <div className="mt-0.5 text-[10px] text-[#efc97b]">
                                Seçenek: {mods.join(", ")}
                              </div>
                            )}

                            {item.kitchenNote && (
                              <div className="mt-0.5 text-[10px] italic text-[#f2d38f]">
                                Mutfak Notu: &ldquo;{item.kitchenNote}&rdquo;
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Check Summary Footer (Strictly No Price!) */}
              <div className="border-t border-[#344647] bg-[#141e1f] p-3 text-xs">
                <div className="flex items-center justify-between text-[#9aaead]">
                  <span>Toplam Kayıtlı Kalem</span>
                  <b className="text-[#f0f5f3]">{allSessionItems.length}</b>
                </div>
                <div className="mt-1 flex items-center justify-between text-[#9aaead]">
                  <span>Yeni Tur (Gönderilecek Taslak)</span>
                  <b className="text-[#73d8c6]">{draftCount}</b>
                </div>
                <div className="mt-2 rounded-lg border border-[#665637] bg-[#2e281b] px-2.5 py-1.5 text-center text-[10px] font-bold text-[#efc97b]">
                  Bu ekranda fiyat, toplam veya ödeme alanı gösterilmez
                </div>
              </div>
            </div>

            {/* CENTER MENU BOARD (col-span-6) */}
            <div className="flex flex-col justify-between bg-[#1b2525] lg:col-span-6">
              <div className="grid flex-1 grid-cols-1 sm:grid-cols-12">
                {/* Main Categories Column */}
                <div className="flex gap-1.5 overflow-x-auto border-b border-[#2f4040] bg-[#162020] p-2 sm:col-span-4 sm:flex-col sm:border-r sm:border-b-0">
                  <div className="hidden px-2 py-1 text-[9px] font-extrabold tracking-wider text-[#9aaead] uppercase sm:block">
                    ANA KATEGORİLER
                  </div>
                  {mainCategories.map((cat: any) => {
                    const active = selectedMainCategoryId === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setSelectedMainCategoryId(cat.id);
                          setSelectedSubCategoryId(null);
                          setProductSearch("");
                        }}
                        className={`shrink-0 rounded-lg border px-3 py-2.5 text-left text-xs font-bold transition ${
                          active
                            ? "border-[#3b6e66] bg-[#284945] text-[#d7fff7]"
                            : "border-transparent text-[#c4cfcd] hover:bg-[#202f30]"
                        }`}
                      >
                        {cat.name}
                      </button>
                    );
                  })}
                </div>

                {/* Product Touch Tiles Grid */}
                <div className="p-2.5 sm:col-span-8">
                  {config?.learningModeEnabled && showContextualHints && (
                    <div className="mb-2 rounded-lg border border-[#3c6259] bg-[#1c3531] px-2.5 py-1.5 text-[10px] text-[#c0eee5]">
                      <strong>İpucu:</strong> Ürün kutusuna dokunduğunuzda aktif{" "}
                      <strong>Koltuk {activeSeatNumber}</strong> için yeni tura
                      eklenir. Paylaşılabilir ürünler{" "}
                      <span className="text-[#efc97b]">[Paylaşılabilir]</span>{" "}
                      rozeti taşır.
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {displayedProducts.map((product: any) => {
                      const stationName =
                        product.station?.name ||
                        product.station?.code ||
                        "ANA MUTFAK";
                      const isOutOfStock =
                        product.is86ed ||
                        (product.availableCount !== null && product.availableCount <= 0);
                      const hasPortionLimit =
                        product.availableCount !== null && product.availableCount > 0;

                      return (
                        <button
                          key={product.id}
                          type="button"
                          disabled={isOutOfStock || busyAction === `add-item-${product.id}`}
                          onClick={() => {
                            if (isOutOfStock) {
                              notify(`"${product.name}" ürünü mutfakta tükenmiştir (86 / Out of Stock).`, "red");
                              return;
                            }
                            handleAddDraftItem(product);
                          }}
                          className={`group flex min-h-[88px] flex-col justify-between rounded-xl border p-2.5 text-left text-[#f5fffa] shadow transition ${
                            isOutOfStock
                              ? "border-[#684442] bg-[#3a2625] opacity-60 grayscale cursor-not-allowed"
                              : "border-[#52615d] bg-[#2e5f4e] hover:brightness-110 active:scale-[0.99]"
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-1">
                              <span className="text-xs font-extrabold leading-snug">
                                {product.receiptName || product.name}
                              </span>
                              {isOutOfStock && (
                                <span className="rounded bg-[#632724] px-1.5 py-0.5 text-[8px] font-black text-[#ffc4bc] shrink-0 border border-[#8b3d39]">
                                  86 · TÜKENDİ
                                </span>
                              )}
                              {hasPortionLimit && !isOutOfStock && (
                                <span className="rounded bg-[#543d1a] px-1.5 py-0.5 text-[8px] font-black text-[#ffd68a] shrink-0 border border-[#7a5823]">
                                  Son {product.availableCount}
                                </span>
                              )}
                            </div>
                            {product.receiptName &&
                              product.receiptName !== product.name && (
                                <div className="truncate text-[10px] text-[#d1e6dc]">
                                  {product.name}
                                </div>
                              )}
                          </div>

                          <div className="mt-2 space-y-1">
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="rounded bg-black/30 px-1.5 py-0.5 text-[9px] font-bold text-[#bdf0e4]">
                                {stationName}
                              </span>
                              {product.isShareable && (
                                <span className="rounded bg-[#3b3325] px-1.5 py-0.5 text-[8px] font-bold text-[#f2d38f]">
                                  Paylaşılabilir
                                </span>
                              )}
                              {product.askSeatOnAdd && (
                                <span className="rounded bg-[#233544] px-1.5 py-0.5 text-[8px] font-bold text-[#8dc4e9]">
                                  Koltuk Sor
                                </span>
                              )}
                            </div>
                            {product.allergens && (
                              <div className="truncate text-[9px] text-[#ffe0a2]">
                                ⚠ Alerjen: {product.allergens}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Bottom Subcategories Strip */}
              <div className="border-t border-[#344647] bg-[#202b2c] p-2">
                <div className="mb-1 text-[9px] font-extrabold tracking-wider text-[#9aaead] uppercase">
                  ALT KATEGORİLER VE HIZLI FİLTRE
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  <button
                    type="button"
                    onClick={() => setSelectedSubCategoryId(null)}
                    className={`rounded-md border py-2 px-2 text-[10px] font-extrabold transition ${
                      selectedSubCategoryId === null
                        ? "border-[#eadfae] bg-[#456e68] text-white"
                        : "border-[#667573] bg-[#2d3e3d] text-[#c4cfcd]"
                    }`}
                  >
                    Tümü ({mainCategories.find((c: any) => c.id === selectedMainCategoryId)?.name || "Menü"})
                  </button>
                  {subCategories.map((sub: any, idx: number) => {
                    const bgColors = [
                      "bg-[#477985]",
                      "bg-[#77658a]",
                      "bg-[#a75d71]",
                      "bg-[#aa573f]",
                    ];
                    const active = selectedSubCategoryId === sub.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setSelectedSubCategoryId(sub.id)}
                        className={`rounded-md border py-2 px-2 text-[10px] font-extrabold text-white transition ${
                          bgColors[idx % bgColors.length]
                        } ${
                          active
                            ? "ring-2 ring-[#eadfae] border-white"
                            : "border-[#667573] opacity-90 hover:opacity-100"
                        }`}
                      >
                        {sub.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT ACTION STRIP (col-span-2) */}
            <div className="flex flex-col gap-1.5 bg-[#53605f] p-1.5 lg:col-span-2">
              <button
                type="button"
                onClick={() => onNavigate("SCR-05")}
                className="flex flex-1 flex-col justify-center rounded border border-[#798582] bg-[#384544] p-2.5 text-left transition hover:brightness-110"
              >
                <span className="text-[9px] font-bold text-[#73d8c6]">SCR-05</span>
                <span className="text-xs font-extrabold text-[#f0f5f3]">
                  KALEM SEÇENEKLERİ
                </span>
                <small className="mt-0.5 text-[9px] text-[#9aaead]">
                  Adet, Modifier, Koltuk, Paylaşım
                </small>
              </button>

              <button
                type="button"
                onClick={() => onNavigate("SCR-06")}
                className="flex flex-1 flex-col justify-center rounded border border-[#798582] bg-[#384544] p-2.5 text-left transition hover:brightness-110"
              >
                <span className="text-[9px] font-bold text-[#efc97b]">SCR-06</span>
                <span className="text-xs font-extrabold text-[#f0f5f3]">
                  BEKLET / ZAMANLA
                </span>
                <small className="mt-0.5 text-[9px] text-[#9aaead]">
                  Kalemi/Turu Tut, Saat Ata
                </small>
              </button>

              <button
                type="button"
                onClick={() => onNavigate("SCR-09")}
                className="flex flex-1 flex-col justify-center rounded border border-[#754541] bg-[#452c2a] p-2.5 text-left transition hover:brightness-110"
              >
                <span className="text-[9px] font-bold text-[#ffc0b5]">SCR-09</span>
                <span className="text-xs font-extrabold text-[#ffc7be]">
                  İPTAL TALEBİ
                </span>
                <small className="mt-0.5 text-[9px] text-[#f18d83]">
                  Gönderilmiş Kalem Void
                </small>
              </button>

              <button
                type="button"
                onClick={() => onNavigate("SCR-11")}
                className="flex flex-1 flex-col justify-center rounded border border-[#798582] bg-[#384544] p-2.5 text-left transition hover:brightness-110"
              >
                <span className="text-[9px] font-bold text-[#8dc4e9]">SCR-11</span>
                <span className="text-xs font-extrabold text-[#f0f5f3]">
                  FİYATSIZ ADİSYON
                </span>
                <small className="mt-0.5 text-[9px] text-[#9aaead]">
                  80mm Servis Özeti Önizle
                </small>
              </button>

              {/* MICROS TSR: RE-ORDER / REPEAT ROUND */}
              <button
                type="button"
                disabled={busyAction === "reorder-round" || !activeSession}
                onClick={() => handleReorderRound()}
                className="flex flex-1 flex-col justify-center rounded border border-[#49605b] bg-[#243d39] p-2.5 text-left transition hover:brightness-110 disabled:opacity-50"
              >
                <span className="text-[9px] font-bold text-[#73d8c6]">MICROS RE-ORDER</span>
                <span className="text-xs font-extrabold text-[#bdf0e4]">
                  {busyAction === "reorder-round" ? "⟳ KOPYALANIYOR..." : "⟲ TURU TEKRARLA"}
                </span>
                <small className="mt-0.5 text-[9px] text-[#9aaead]">
                  Son turun kalemlerini yeni tura al
                </small>
              </button>

              {/* MICROS TSR: REPRINT KITCHEN CHIT */}
              <button
                type="button"
                onClick={() => setShowReprintModal(true)}
                className="flex flex-1 flex-col justify-center rounded border border-[#665637] bg-[#3b3325] p-2.5 text-left transition hover:brightness-110"
              >
                <span className="text-[9px] font-bold text-[#efc97b]">DUPLICATE PRINT</span>
                <span className="text-xs font-extrabold text-[#f2d38f]">
                  🖨️ FİŞİ TEKRAR BAS
                </span>
                <small className="mt-0.5 text-[9px] text-[#c9b78b]">
                  Kopya mutfak fişi çıkar
                </small>
              </button>

              <button
                type="button"
                disabled={busyAction === "send-kitchen"}
                onClick={handleSendRoundToKitchen}
                className="flex flex-1 flex-col justify-center rounded border-2 border-[#d9fbf0] bg-[#c8f0e6] p-3 text-left text-[#18332e] shadow-lg transition hover:brightness-105 disabled:opacity-50"
              >
                <span className="text-[9px] font-black tracking-wider uppercase">
                  MUTFAK-WINDOWS ({draftCount} KALEM)
                </span>
                <span className="text-sm font-black">
                  {busyAction === "send-kitchen"
                    ? "GÖNDERİLİYOR..."
                    : "MUTFAĞA GÖNDER →"}
                </span>
                <small className="mt-0.5 font-mono text-[8px] opacity-80">
                  Key: {roundIdempotencyKey.slice(0, 14)}
                </small>
              </button>
            </div>
          </div>
        </div>
        {renderMicrosModals()}
      </div>
    );
  }

  // ============================================================================
  // RENDER SCR-05: ÜRÜN SEÇENEĞİ VE KALEM DÜZENLEME
  // ============================================================================
  if (activeScreen === "SCR-05") {
    const seatCount = Math.max(activeSession?.seatCount ?? 4, 4);
    const isSentItem = selectedOrderItem?.status === "SENT";
    const isCancelledItem =
      selectedOrderItem?.status === "CANCELLED" ||
      selectedOrderItem?.status === "CANCEL_REQUESTED";

    const toggleModifierOption = (baseOptName: string) => {
      if (isSentItem || isCancelledItem) return;
      const prefixObj = PREFIX_CONFIGS.find((p) => p.id === selectedPrefix);
      const targetPrefixed = prefixObj?.prefixText
        ? `${prefixObj.prefixText}${baseOptName}`
        : baseOptName;

      setEditModifiers((prev) => {
        const existingIndex = prev.findIndex((m) => {
          return (
            m === baseOptName ||
            m === targetPrefixed ||
            PREFIX_CONFIGS.some((p) => p.prefixText && m === `${p.prefixText}${baseOptName}`)
          );
        });

        if (existingIndex >= 0) {
          const existing = prev[existingIndex];
          if (existing === targetPrefixed) {
            return prev.filter((_, idx) => idx !== existingIndex);
          }
          const updated = [...prev];
          updated[existingIndex] = targetPrefixed;
          return updated;
        } else {
          return [...prev, targetPrefixed];
        }
      });
    };

    const toggleSharedSeat = (seatNum: number) => {
      if (isSentItem || isCancelledItem) return;
      setEditSharedSeats((prev) =>
        prev.includes(seatNum)
          ? prev.filter((s) => s !== seatNum)
          : [...prev, seatNum].sort((a, b) => a - b)
      );
    };

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-extrabold tracking-[0.16em] text-[#73d8c6] uppercase">
              SCR-05 · ÜRÜN SEÇENEĞİ VE KALEM DÜZENLEME
            </div>
            <h1 className="mt-1 text-2xl font-bold text-[#f0f5f3]">
              Kalem Ayrıntısı, Modifier ve Koltuk Paylaşımı
            </h1>
            <p className="mt-1 text-xs text-[#9aaead]">
              Taslak ve bekletilen kalemleri düzenleyin. Mutfağa gönderilmiş (SENT)
              kalemler silinemez veya adedi düşürülemez; iptal talebi (SCR-09)
              gerektirir.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("SCR-04")}
            className="rounded-xl border border-[#344647] bg-[#202f30] px-4 py-2 text-xs font-bold text-[#f0f5f3] hover:border-[#73d8c6]"
          >
            ← Sipariş Ekranına Dön (SCR-04)
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left Column: Session Items + Quantity/Note/Seat Form */}
          <div className="space-y-4 lg:col-span-6">
            <div className="overflow-hidden rounded-2xl border border-[#344647] bg-[#192526]">
              <div className="flex items-center justify-between border-b border-[#344647] px-4 py-3">
                <b className="text-xs text-[#f0f5f3]">
                  {activeTable?.name || "Masa"} · Açık Oturum Kalemleri
                </b>
                <small className="text-[10px] text-[#73d8c6]">
                  Fiyat alanı yoktur
                </small>
              </div>

              <div className="divide-y divide-[#2b3b3b] max-h-60 overflow-y-auto">
                {allSessionItems.length === 0 ? (
                  <div className="p-5 text-center text-xs text-[#9aaead]">
                    Bu masada henüz kalem yok. SCR-04 ekranından ürün ekleyin.
                  </div>
                ) : (
                  allSessionItems.map((item: any) => {
                    const active = selectedOrderItem?.id === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedOrderItemId(item.id)}
                        className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition ${
                          active ? "bg-[#244440]" : "hover:bg-[#202f30]"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#324341] text-xs font-black text-[#f0f5f3]">
                            {item.quantity}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 truncate text-xs font-bold text-[#f0f5f3]">
                              <span>{item.productNameSnapshot}</span>
                              {item.isRush && (
                                <span className="rounded bg-[#efc97b] px-1.5 py-0.5 text-[9px] font-black text-[#192526]">
                                  ⚡ RUSH
                                </span>
                              )}
                            </div>
                            <div className="truncate text-[10px] text-[#9aaead]">
                              Koltuk {item.seatNumber || "—"} ·{" "}
                              {item.kitchenNote
                                ? `Not: ${item.kitchenNote}`
                                : "Not yok"}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                            item.status === "SENT"
                              ? "border-[#3c6058] bg-[#243d39] text-[#bdf0e4]"
                              : "border-[#665637] bg-[#3b3325] text-[#f2d38f]"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {selectedOrderItem && (
                <div className="border-t border-[#344647] bg-[#141f20] p-4 space-y-4">
                  {isSentItem && (
                    <div className="rounded-xl border border-[#754541] bg-[#3d2929] p-3 text-xs text-[#ffc4bc]">
                      <div className="font-extrabold">
                        ⚠ Bu Kalem Mutfağa Gönderilmiştir (SENT)
                      </div>
                      <p className="mt-1 text-[11px]">
                        Gönderilmiş kalemler doğrudan silinemez veya adedi
                        azaltılamaz. İptal veya miktar düşümü için yönetici onaylı{" "}
                        <strong>İptal Talebi (SCR-09)</strong> oluşturun. (Yalnızca
                        denetim kayıtlı koltuk numarası düzeltmesi yapılabilir.)
                      </p>
                      <button
                        type="button"
                        onClick={() => onNavigate("SCR-09")}
                        className="mt-2 rounded-lg border border-[#f18d83] bg-[#52302e] px-3 py-1.5 text-xs font-extrabold text-[#ffc7be]"
                      >
                        ⊘ Bu Kalem İçin İptal Talebi Aç (SCR-09) →
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[10px] font-extrabold text-[#aab9b6] uppercase">
                        ADET (MİKTAR)
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isSentItem || isCancelledItem}
                          onClick={() =>
                            setEditQuantity((q) => Math.max(1, q - 1))
                          }
                          className="h-9 w-9 rounded-lg border border-[#344647] bg-[#202f30] text-sm font-black disabled:opacity-40"
                        >
                          −
                        </button>
                        <strong className="min-w-[36px] text-center text-base font-black text-[#73d8c6]">
                          {editQuantity}
                        </strong>
                        <button
                          type="button"
                          disabled={isSentItem || isCancelledItem}
                          onClick={() =>
                            setEditQuantity((q) => Math.min(99, q + 1))
                          }
                          className="h-9 w-9 rounded-lg border border-[#344647] bg-[#202f30] text-sm font-black disabled:opacity-40"
                        >
                          ＋
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[10px] font-extrabold text-[#aab9b6] uppercase">
                        KOLTUK ATA / DEĞİŞTİR
                      </label>
                      <select
                        value={editSeatNumber ?? ""}
                        onChange={(e) =>
                          setEditSeatNumber(
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                        className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3]"
                      >
                        <option value="">Atanmamış</option>
                        {Array.from({ length: seatCount }, (_, i) => i + 1).map(
                          (s) => (
                            <option key={s} value={s}>
                              Koltuk {s}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] font-extrabold text-[#aab9b6] uppercase">
                      MUTFAK HAZIRLAMA NOTU
                    </label>
                    <input
                      type="text"
                      disabled={isSentItem || isCancelledItem}
                      value={editKitchenNote}
                      onChange={(e) => setEditKitchenNote(e.target.value)}
                      placeholder="Örn: Limon ayrı, sossuz, çocuk için ılık..."
                      className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3] disabled:opacity-50"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={
                          isSentItem ||
                          isCancelledItem ||
                          busyAction === `remove-${selectedOrderItem.id}`
                        }
                        onClick={() => handleRemoveDraftItem(selectedOrderItem)}
                        className="rounded-xl border border-[#754541] bg-[#452c2a] px-3.5 py-2 text-xs font-bold text-[#ffc7be] disabled:opacity-40"
                      >
                        Taslaktan Kaldır
                      </button>

                      {/* Single Item RUSH Toggle */}
                      <button
                        type="button"
                        disabled={busyAction === `item-rush-${selectedOrderItem.id}`}
                        onClick={() => handleToggleItemRush(selectedOrderItem.id)}
                        className={`rounded-xl border px-3 py-2 text-xs font-extrabold transition ${
                          selectedOrderItem.isRush
                            ? "border-[#efc97b] bg-[#393321] text-[#f2d38f] ring-1 ring-[#efc97b]"
                            : "border-[#49605b] bg-[#202f30] text-[#9aaead] hover:text-[#f0f5f3]"
                        }`}
                      >
                        {selectedOrderItem.isRush
                          ? "⚡ RUSH (ÖNCELİK): AKTİF"
                          : "⚡ ACİL (RUSH) YAP"}
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={isCancelledItem || busyAction === "update-item"}
                      onClick={handleUpdateDraftItem}
                      className="rounded-xl border border-[#58b7a6] bg-[#73d8c6] px-5 py-2 text-xs font-extrabold text-[#10221f] hover:brightness-110 disabled:opacity-40"
                    >
                      {busyAction === "update-item"
                        ? "Kaydediliyor..."
                        : isSentItem
                        ? "Koltuk Düzeltmesini Kaydet (Audit)"
                        : "Seçenekleri Uygula ✓"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Prefix Modifiers + Modifier Groups + Multi-Seat Item Sharing */}
          <div className="space-y-4 lg:col-span-6">
            {/* MICROS Prefix Modifiers Bar */}
            <div className="rounded-2xl border border-[#344647] bg-[#192526] p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-extrabold tracking-wider text-[#efc97b] uppercase">
                  ÖN EK DEĞİŞTİRİCİLER (MICROS PREFIX MODIFIERS)
                </span>
                <span className="text-[10px] text-[#9aaead]">
                  Önce ön ek seçin, ardından aşağıdaki seçeneğe tıklayın
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                {PREFIX_CONFIGS.map((p) => {
                  const active = selectedPrefix === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={isSentItem || isCancelledItem}
                      onClick={() => setSelectedPrefix(p.id)}
                      className={`rounded-lg border px-2 py-1.5 text-center text-xs font-black transition ${
                        active
                          ? "border-[#efc97b] bg-[#42381f] text-[#f2d38f] shadow-md ring-1 ring-[#efc97b]"
                          : "border-[#344647] bg-[#141f20] text-[#9aaead] hover:bg-[#202f30] hover:text-[#f0f5f3]"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modifier Groups */}
            <div className="rounded-2xl border border-[#344647] bg-[#192526] p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <b className="text-xs text-[#f0f5f3]">
                    Hazırlama Seçenekleri (Modifier Grupları)
                  </b>
                  <p className="text-[10px] text-[#9aaead]">
                    Zorunlu veya isteğe bağlı mutfak hazırlama nitelikleri (Fiyat
                    eklemez)
                  </p>
                </div>
                <span className="rounded-full border border-[#3c6058] bg-[#243d39] px-2.5 py-0.5 text-[10px] font-bold text-[#bdf0e4]">
                  {editModifiers.length} seçili
                </span>
              </div>

              <div className="space-y-3">
                {modifierGroups.map((group: any) => (
                  <div
                    key={group.id}
                    className="rounded-xl border border-[#2d3d3d] bg-[#141f20] p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-[#f0f5f3]">
                        {group.name}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[9px] font-bold ${
                          group.required
                            ? "bg-[#3b3325] text-[#efc97b]"
                            : "bg-[#202f30] text-[#9aaead]"
                        }`}
                      >
                        {group.required
                          ? `Zorunlu (Min ${group.minSelect || 1})`
                          : `İsteğe Bağlı (Max ${group.maxSelect || 3})`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(group.options || []).map((opt: any) => {
                        const matchingMod = editModifiers.find(
                          (m) =>
                            m === opt.name ||
                            PREFIX_CONFIGS.some(
                              (p) => p.prefixText && m === `${p.prefixText}${opt.name}`
                            )
                        );
                        const checked = Boolean(matchingMod);
                        return (
                          <button
                            key={opt.id || opt.name}
                            type="button"
                            disabled={isSentItem || isCancelledItem}
                            onClick={() => toggleModifierOption(opt.name)}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
                              checked
                                ? "border-[#73d8c6] bg-[#244440] text-[#dcfff6]"
                                : "border-[#344647] bg-[#192526] text-[#c4cfcd] hover:border-[#58b7a6]"
                            }`}
                          >
                            {checked ? "✓ " : ""}
                            {matchingMod || opt.name}
                            {opt.qualifier && opt.qualifier !== "DEFAULT" && (
                              <span className="ml-1 text-[9px] text-[#efc97b]">
                                ({opt.qualifier})
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shareable Item Multi-Seat Selector */}
            <div className="rounded-2xl border border-[#344647] bg-[#192526] p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <b className="text-xs text-[#f0f5f3]">
                    Ürünü Paylaştır (Çoklu Koltuk İlişkilendirme)
                  </b>
                  <p className="text-[10px] text-[#9aaead]">
                    Paylaşım işlevi ürün adedini (miktarını) çoğaltmaz; aynı kalemin
                    hangi koltuklara birlikte servis edileceğini mutfak fişinde
                    gösterir.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateGuestSeat(
                      activeSession?.guestCount ?? 2,
                      seatCount + 1
                    )
                  }
                  className="rounded-lg border border-[#58b7a6] bg-[#244440] px-2.5 py-1 text-[10px] font-extrabold text-[#73d8c6]"
                >
                  + Koltuk Ekle
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {Array.from({ length: seatCount }, (_, i) => i + 1).map((sNum) => {
                  const isShared = editSharedSeats.includes(sNum);
                  return (
                    <button
                      key={sNum}
                      type="button"
                      disabled={isSentItem || isCancelledItem}
                      onClick={() => toggleSharedSeat(sNum)}
                      className={`rounded-xl border px-3.5 py-2 text-xs font-extrabold transition ${
                        isShared
                          ? "border-[#73d8c6] bg-[#244440] text-[#73d8c6]"
                          : "border-[#49605b] bg-[#243432] text-[#c4cfcd]"
                      }`}
                    >
                      {isShared ? "✓ " : ""}Koltuk {sNum}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 rounded-xl border border-[#3c6259] bg-[#1c3531] p-2.5 text-[11px] text-[#c0eee5]">
                Seçili Paylaşım Koltukları:{" "}
                <strong className="font-mono text-[#73d8c6]">
                  {editSharedSeats.length > 0
                    ? `[${editSharedSeats.join(", ")}]`
                    : "Paylaşım seçilmedi (Tek koltuk)"}
                </strong>{" "}
                — Kalem Adedi: <strong>{editQuantity}</strong> (Sabit kalır,
                çoğaltılmaz).
              </div>
            </div>
          </div>
        </div>
        {renderMicrosModals()}
      </div>
    );
  }

  // ============================================================================
  // RENDER SCR-06: BEKLETME VE ZAMANLI GÖNDERİM
  // ============================================================================
  const allScheduledOrHeldAcrossTables = sessions
    .filter((s: any) => s.status === "OPEN")
    .flatMap((s: any) => {
      const sItems =
        Array.isArray(s.items) && s.items.length > 0
          ? s.items
          : (s.rounds || []).flatMap((r: any) => r.items || []);
      return sItems
        .filter(
          (it: any) =>
            it.status === "HELD" ||
            it.status === "SCHEDULED" ||
            it.status === "OVERDUE"
        )
        .map((it: any) => ({
          ...it,
          sessionRef: s.referenceCode,
          tableName:
            tables.find((t: any) => t.id === s.tableId)?.name || "Masa",
          waiterName: s.openedBy?.name || "Garson",
          openedById: s.openedById,
        }));
    })
    .filter((it: any) => {
      if (currentUser?.role === "WAITER") {
        return (
          it.createdById === currentUser.id ||
          it.openedById === currentUser.id ||
          it.sessionId === activeSession?.id
        );
      }
      return true;
    });

  const toggleSelectScheduleItem = (id: string) => {
    setSelectedScheduleItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold tracking-[0.16em] text-[#73d8c6] uppercase">
            SCR-06 · BEKLETME VE ZAMANLI GÖNDERİM
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#f0f5f3]">
            Gönderim Planı ve Sunucu Zamanlayıcısı
          </h1>
          <p className="mt-1 text-xs text-[#9aaead]">
            Kalemi veya servis turunu bekletin, hemen mutfağa gönderin (Fire Now) ya
            da restoran sunucusunun <code>Europe/Istanbul</code> saatine göre
            zamanlayın.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busyAction === "eval-schedules"}
            onClick={handleEvaluateScheduledItems}
            className="rounded-xl border border-[#efc97b] bg-[#3b3325] px-3.5 py-2 text-xs font-extrabold text-[#f2d38f] hover:brightness-110"
          >
            ⏱ Zamanı Gelenleri Kontrol Et
          </button>
          <button
            type="button"
            onClick={() => onNavigate("SCR-04")}
            className="rounded-xl border border-[#344647] bg-[#202f30] px-4 py-2 text-xs font-bold text-[#f0f5f3] hover:border-[#73d8c6]"
          >
            ← Siparişe Dön (SCR-04)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left: Active Table Draft / Held / Scheduled Items */}
        <div className="rounded-2xl border border-[#344647] bg-[#192526] lg:col-span-6">
          <div className="flex items-center justify-between border-b border-[#344647] px-4 py-3">
            <b className="text-xs text-[#f0f5f3]">
              Gönderilmeyi Bekleyen Kalemler ({activeTable?.name || "Masa"})
            </b>
            <small className="text-[10px] text-[#9aaead]">
              {selectedScheduleItemIds.length} kalem seçili
            </small>
          </div>

          <div className="divide-y divide-[#2b3b3b] max-h-80 overflow-y-auto">
            {pendingTableItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#9aaead]">
                Bu masada bekleyen veya taslak kalem bulunmuyor.
              </div>
            ) : (
              pendingTableItems.map((item: any) => {
                const checked = selectedScheduleItemIds.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-[#202f30]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelectScheduleItem(item.id)}
                        className="h-4 w-4 accent-[#73d8c6]"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#f0f5f3]">
                          {item.quantity} × {item.productNameSnapshot}
                        </div>
                        <div className="text-[10px] text-[#9aaead]">
                          İstasyon: {item.stationNameSnapshot} · Koltuk{" "}
                          {item.seatNumber || "—"}
                          {item.scheduledAt
                            ? ` · Planlı: ${formatIstanbulDateTime(
                                item.scheduledAt
                              )}`
                            : ""}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                        item.status === "HELD"
                          ? "border-[#665637] bg-[#3b3325] text-[#f2d38f]"
                          : item.status === "SCHEDULED"
                          ? "border-[#4b6782] bg-[#233544] text-[#8dc4e9]"
                          : "border-[#465353] bg-[#2d3939] text-[#bbc8c6]"
                      }`}
                    >
                      {item.status === "HELD"
                        ? "Bekletildi"
                        : item.status === "SCHEDULED"
                        ? "Zamanlandı"
                        : "Taslak"}
                    </span>
                  </label>
                );
              })
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-[#344647] bg-[#141f20] p-4">
            <button
              type="button"
              disabled={selectedScheduleItemIds.length === 0}
              onClick={() => handleHoldOrSchedule("HOLD_ITEMS")}
              className="rounded-xl border border-[#665637] bg-[#3b3325] px-3.5 py-2 text-xs font-bold text-[#f2d38f] disabled:opacity-40"
            >
              ⏸ Seçileni Beklet
            </button>
            <button
              type="button"
              disabled={pendingTableItems.length === 0}
              onClick={() => handleHoldOrSchedule("HOLD_ROUND")}
              className="rounded-xl border border-[#344647] bg-[#202f30] px-3.5 py-2 text-xs font-bold text-[#f0f5f3] disabled:opacity-40"
            >
              ⏸ Turu Beklet
            </button>
            <button
              type="button"
              disabled={selectedScheduleItemIds.length === 0}
              onClick={() => handleHoldOrSchedule("FIRE_NOW")}
              className="ml-auto rounded-xl border border-[#58b7a6] bg-[#73d8c6] px-4 py-2 text-xs font-extrabold text-[#10221f] hover:brightness-110 disabled:opacity-40"
            >
              ▶ Şimdi Gönder (Fire Now)
            </button>
          </div>
        </div>

        {/* Right: Create Schedule + Active Held & Scheduled List */}
        <div className="space-y-4 lg:col-span-6">
          {/* Create Server-Side Schedule */}
          <div className="rounded-2xl border border-[#344647] bg-[#192526] p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <b className="text-xs text-[#f0f5f3]">Zamanlı Gönderim Oluştur</b>
              <span className="rounded-full border border-[#3c6058] bg-[#243d39] px-2.5 py-0.5 text-[10px] font-bold text-[#bdf0e4]">
                Sunucu Zamanlayıcısı (Europe/Istanbul)
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-extrabold text-[#aab9b6] uppercase">
                  GÖNDERİM TARİHİ VE SAATİ
                </label>
                <input
                  type="datetime-local"
                  value={scheduleDateTime}
                  onChange={(e) => setScheduleDateTime(e.target.value)}
                  className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-extrabold text-[#aab9b6] uppercase">
                  UYGULAMA KAPSAMI
                </label>
                <select
                  value={scheduleScope}
                  onChange={(e) =>
                    setScheduleScope(
                      e.target.value as "SELECTED_ITEMS" | "ENTIRE_ROUND"
                    )
                  }
                  className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3]"
                >
                  <option value="SELECTED_ITEMS">Seçili Kalemler</option>
                  <option value="ENTIRE_ROUND">Bu Servis Turunun Tamamı</option>
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-[#3c6259] bg-[#1c3531] p-3 text-[11px] text-[#c0eee5]">
              Saat restoran sunucusunun yerel saatine (
              <code>Europe/Istanbul</code>) göre çalışır. Garsonun tableti/telefonu
              uykuda veya kapalı olsa bile iş sunucuda kalıcı olarak saklanır.
            </div>

            <button
              type="button"
              disabled={pendingTableItems.length === 0}
              onClick={() => handleHoldOrSchedule("SCHEDULE")}
              className="w-full rounded-xl border border-[#58b7a6] bg-[#73d8c6] px-4 py-2.5 text-xs font-extrabold text-[#10221f] hover:brightness-110 disabled:opacity-40"
            >
              ⏱ Seçili Kapsama Zaman Ata
            </button>
          </div>

          {/* All Active Held & Scheduled Items Across Tables */}
          <div className="rounded-2xl border border-[#344647] bg-[#192526] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#344647] px-4 py-3">
              <div>
                <b className="text-xs text-[#f0f5f3]">
                  Aktif Bekletilen ve Zamanlı Planlar
                </b>
                <small className="ml-2 text-[10px] text-[#9aaead]">
                  {currentUser?.role === "WAITER"
                    ? "Kendi masalarınız"
                    : "Tüm restoran masaları"}
                </small>
              </div>
              <button
                type="button"
                onClick={onRefresh}
                className="rounded-lg border border-[#344647] bg-[#202f30] px-2.5 py-1 text-[10px] font-bold text-[#f0f5f3]"
              >
                ↻ Yenile
              </button>
            </div>

            <div className="divide-y divide-[#2b3b3b] max-h-64 overflow-y-auto">
              {allScheduledOrHeldAcrossTables.length === 0 ? (
                <div className="p-5 text-center text-xs text-[#9aaead]">
                  Aktif bekletilen veya zamanlanmış kalem bulunmuyor.
                </div>
              ) : (
                allScheduledOrHeldAcrossTables.map((plan: any) => (
                  <div key={plan.id} className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-[#f0f5f3]">
                          {plan.tableName} ({plan.sessionRef}) · {plan.quantity} ×{" "}
                          {plan.productNameSnapshot}
                        </div>
                        <div className="text-[10px] text-[#9aaead]">
                          Planlayan: {plan.waiterName} · İstasyon:{" "}
                          {plan.stationNameSnapshot} ·{" "}
                          {plan.scheduledAt
                            ? `Hedef Saat: ${formatIstanbulDateTime(
                                plan.scheduledAt
                              )}`
                            : "Süresiz Bekletildi (HELD)"}
                        </div>
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                          plan.status === "OVERDUE"
                            ? "border-[#684442] bg-[#3e2c2b] text-[#ffc0b5]"
                            : plan.status === "SCHEDULED"
                            ? "border-[#4b6782] bg-[#233544] text-[#8dc4e9]"
                            : "border-[#665637] bg-[#3b3325] text-[#f2d38f]"
                        }`}
                      >
                        {plan.status === "OVERDUE"
                          ? "Vadesi Geldi"
                          : plan.status === "SCHEDULED"
                          ? "Zamanlandı"
                          : "Bekletildi"}
                      </span>
                    </div>

                    {rescheduleTargetId === plan.id && (
                      <div className="flex items-center gap-2 rounded-lg border border-[#344647] bg-[#141f20] p-2">
                        <input
                          type="datetime-local"
                          value={rescheduleNewTime}
                          onChange={(e) => setRescheduleNewTime(e.target.value)}
                          className="rounded border border-[#3a4c4b] bg-[#101a1a] px-2 py-1 text-xs text-[#f0f5f3]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleHoldOrSchedule(
                              "RESCHEDULE",
                              [plan.id],
                              rescheduleNewTime,
                              plan.sessionId
                            )
                          }
                          className="rounded bg-[#73d8c6] px-2.5 py-1 text-[10px] font-extrabold text-[#10221f]"
                        >
                          Kaydet
                        </button>
                        <button
                          type="button"
                          onClick={() => setRescheduleTargetId(null)}
                          className="rounded bg-[#202f30] px-2 py-1 text-[10px] text-[#9aaead]"
                        >
                          Vazgeç
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setRescheduleTargetId(plan.id);
                          setRescheduleNewTime(defaultIstanbulDateTimeLocal(30));
                        }}
                        className="rounded-lg border border-[#344647] bg-[#202f30] px-2.5 py-1 text-[10px] font-bold text-[#f0f5f3] hover:border-[#73d8c6]"
                      >
                        Saati Değiştir
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleHoldOrSchedule(
                            "UNSCHEDULE",
                            [plan.id],
                            null,
                            plan.sessionId
                          )
                        }
                        className="rounded-lg border border-[#754541] bg-[#452c2a] px-2.5 py-1 text-[10px] font-bold text-[#ffc7be]"
                      >
                        Zamanlamayı Kaldır
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleHoldOrSchedule(
                            "FIRE_NOW",
                            [plan.id],
                            null,
                            plan.sessionId
                          )
                        }
                        className="rounded-lg border border-[#58b7a6] bg-[#244440] px-2.5 py-1 text-[10px] font-extrabold text-[#73d8c6]"
                      >
                        ▶ Şimdi Gönder
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ServiceScreensView;
