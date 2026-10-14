import type {
  Role,
  TableOperationalStatus,
  ServiceSessionStatus,
  RoundStatus,
  ItemStatus,
  CancelRequestStatus,
  PrintJobType,
  PrintJobStatus,
  BackupTargetType,
  DiagnosticStatus,
} from "@prisma/client";

export type ScreenId =
  | "SCR-01"
  | "SCR-02"
  | "SCR-03"
  | "SCR-04"
  | "SCR-05"
  | "SCR-06"
  | "SCR-07"
  | "SCR-08"
  | "SCR-09"
  | "SCR-10"
  | "SCR-11"
  | "SCR-12"
  | "SCR-13"
  | "SCR-14"
  | "SCR-15"
  | "SCR-16"
  | "SCR-17"
  | "SCR-18"
  | "SCR-19";

export interface ScreenDefinition {
  id: ScreenId;
  shortCode: string;
  number: string;
  title: string;
  group: "ERİŞİM & KURULUM" | "SERVİS OPERASYONU" | "RESTORAN YÖNETİMİ" | "RAPOR & DENETİM" | "SİSTEM YÖNETİMİ";
  allowedRoles: Role[];
  description: string;
}

export const SCREEN_CATALOG: ScreenDefinition[] = [
  {
    id: "SCR-01",
    shortCode: "s01",
    number: "01",
    title: "Giriş ve Kimlik Doğrulama",
    group: "ERİŞİM & KURULUM",
    allowedRoles: ["SYSTEM_ADMIN", "RESTAURANT_MANAGER", "WAITER"],
    description: "Kişisel kullanıcı adı ve parola/PIN ile yerel sunucu oturumu açma",
  },
  {
    id: "SCR-02",
    shortCode: "s02",
    number: "02",
    title: "İlk Kurulum Sihirbazı",
    group: "ERİŞİM & KURULUM",
    allowedRoles: ["SYSTEM_ADMIN"],
    description: "Restoran adı, masa/alan, ilk yönetici, menü ve Windows yazdırma kuyruğu kurulumu",
  },
  {
    id: "SCR-03",
    shortCode: "s03",
    number: "03",
    title: "Masa Planı ve Masa Listesi",
    group: "SERVİS OPERASYONU",
    allowedRoles: ["SYSTEM_ADMIN", "RESTAURANT_MANAGER", "WAITER"],
    description: "Tüm garsonlar bütün masaları görür; boş masada yeni servis veya açık siparişe devam",
  },
  {
    id: "SCR-04",
    shortCode: "s04",
    number: "04",
    title: "Sipariş / İşlem Ekranı",
    group: "SERVİS OPERASYONU",
    allowedRoles: ["SYSTEM_ADMIN", "RESTAURANT_MANAGER", "WAITER"],
    description: "MICROS TSR referanslı fiyatsız sipariş, kuver/koltuk, servis turu ve öğrenme rehberi",
  },
  {
    id: "SCR-05",
    shortCode: "s05",
    number: "05",
    title: "Ürün Seçeneği ve Kalem",
    group: "SERVİS OPERASYONU",
    allowedRoles: ["SYSTEM_ADMIN", "RESTAURANT_MANAGER", "WAITER"],
    description: "Adet, zorunlu/isteğe bağlı modifier, mutfak notu, koltuk atama ve paylaşılabilir ürün",
  },
  {
    id: "SCR-06",
    shortCode: "s06",
    number: "06",
    title: "Bekletme ve Zamanlı Gönderim",
    group: "SERVİS OPERASYONU",
    allowedRoles: ["SYSTEM_ADMIN", "RESTAURANT_MANAGER", "WAITER"],
    description: "Kalemi/turu bekletme, sunucu saatine göre zamanlama ve şimdi gönderme",
  },
  {
    id: "SCR-07",
    shortCode: "s07",
    number: "07",
    title: "Yönetici Operasyon Panosu",
    group: "RESTORAN YÖNETİMİ",
    allowedRoles: ["SYSTEM_ADMIN", "RESTAURANT_MANAGER"],
    description: "Canlı masa/baskı/iptal durumu, 4 ışıklı bağlantı göstergesi ve Garson Öğrenme Modu anahtarı",
  },
  {
    id: "SCR-08",
    shortCode: "s08",
    number: "08",
    title: "Sipariş ve Masa Ayrıntısı",
    group: "RESTORAN YÖNETİMİ",
    allowedRoles: ["SYSTEM_ADMIN", "RESTAURANT_MANAGER"],
    description: "Servis turları, işlem zaman çizgisi, Masa Taşı ve Servisi Tamamla engel kontrolü",
  },
  {
    id: "SCR-09",
    shortCode: "s09",
    number: "09",
    title: "İptal Talepleri ve Onay",
    group: "RESTORAN YÖNETİMİ",
    allowedRoles: ["SYSTEM_ADMIN", "RESTAURANT_MANAGER", "WAITER"],
    description: "Gönderilmiş kalem iptal talebi, yönetici onay/red kararı ve ayrı mutfak VOID fişi",
  },
  {
    id: "SCR-10",
    shortCode: "s10",
    number: "10",
    title: "Yazıcılar ve Yazdırma Kuyruğu",
    group: "RESTORAN YÖNETİMİ",
    allowedRoles: ["SYSTEM_ADMIN", "RESTAURANT_MANAGER"],
    description: "Mutfak-Windows ve Adisyon-USB kuyruk durumu, Kontrollü Tekrar Dene ve TEKRAR BASKI",
  },
  {
    id: "SCR-11",
    shortCode: "s11",
    number: "11",
    title: "Fiyatsız Adisyon Önizleme",
    group: "RESTORAN YÖNETİMİ",
    allowedRoles: ["SYSTEM_ADMIN", "RESTAURANT_MANAGER"],
    description: "80mm fiyatsız servis özeti önizlemesi ve Adisyon-USB yazdırma (tahsilat belgesi değildir)",
  },
  {
    id: "SCR-12",
    shortCode: "s12",
    number: "12",
    title: "Rapor Merkezi",
    group: "RAPOR & DENETİM",
    allowedRoles: ["SYSTEM_ADMIN", "RESTAURANT_MANAGER"],
    description: "MICROS örnekli 10 operasyonel rapor kategorisi, filtre özeti, CSV ve yazdırma",
  },
  {
    id: "SCR-13",
    shortCode: "s13",
    number: "13",
    title: "Denetim Günlüğü (Audit)",
    group: "RAPOR & DENETİM",
    allowedRoles: ["SYSTEM_ADMIN"],
    description: "Sunucu zaman damgalı, SHA-256 hash zincirli değiştirilemez denetim izi ve imzalı manifest",
  },
  {
    id: "SCR-14",
    shortCode: "s14",
    number: "14",
    title: "Restoran / Masa Tanımları",
    group: "SİSTEM YÖNETİMİ",
    allowedRoles: ["SYSTEM_ADMIN"],
    description: "Yerel restoran, alan (Salon/Teras) ve masa tanımları, aktif/pasif yönetimi",
  },
  {
    id: "SCR-15",
    shortCode: "s15",
    number: "15",
    title: "Menü Yönetimi",
    group: "SİSTEM YÖNETİMİ",
    allowedRoles: ["SYSTEM_ADMIN"],
    description: "Ana/alt kategori, ürün, fiş adı, istasyon, koltuk/paylaşım, modifier ve menü sürümü",
  },
  {
    id: "SCR-16",
    shortCode: "s16",
    number: "16",
    title: "Kullanıcı ve Rol Yönetimi",
    group: "SİSTEM YÖNETİMİ",
    allowedRoles: ["SYSTEM_ADMIN"],
    description: "Kişisel hesaplar, PIN/parola sıfırlama, oturum kapatma, rol ve vardiya iptal yetkisi",
  },
  {
    id: "SCR-17",
    shortCode: "s17",
    number: "17",
    title: "Yazıcı ve İstasyon Ayarları",
    group: "SİSTEM YÖNETİMİ",
    allowedRoles: ["SYSTEM_ADMIN"],
    description: "Adisyon-USB ve Mutfak-Windows kuyrukları, donanım topolojisi (DN-13003-2 + TL-WA801N) ve test fişi",
  },
  {
    id: "SCR-18",
    shortCode: "s18",
    number: "18",
    title: "Yedekleme ve Geri Yükleme",
    group: "SİSTEM YÖNETİMİ",
    allowedRoles: ["SYSTEM_ADMIN"],
    description: "USB ve yerel dizine günlük+manuel 15 kopya döngüsel şifreli yedek ve kurtarma anahtarlı geri yükleme",
  },
  {
    id: "SCR-19",
    shortCode: "s19",
    number: "19",
    title: "Sistem Durumu ve Tanılama",
    group: "SİSTEM YÖNETİMİ",
    allowedRoles: ["SYSTEM_ADMIN"],
    description: "6 adımlı sıralı salt-okunur tanılama, bulgular, ön yedek kapılı onarım ve imzalı bakım paketi",
  },
];

export interface HardwarePackageItem {
  category: string;
  quantity: number;
  selectedModel: string;
  specs: string;
  unitPriceTl: number;
  totalPriceTl: number;
  pilotStatus: string;
}

export const HARDWARE_BOM_PACKAGE: HardwarePackageItem[] = [
  {
    category: "Dokunmatik Server Kasa",
    quantity: 1,
    selectedModel: "Tiwox TP-8610 (veya muadili All-in-One POS)",
    specs: "Ubuntu Linux 24.04 LTS kurulu, Docker üzerinde çalışan veri tabanı ve web sunucusunu barındıran hepsi-bir-arada (All-in-One) dokunmatik terminal (16 GB RAM, 256 GB SSD)",
    unitPriceTl: 37780,
    totalPriceTl: 37780,
    pilotStatus: "Ubuntu Linux 24.04 LTS ve Docker üzerinde PostgreSQL + Next.js sunucu rolü",
  },
  {
    category: "Garson Mobil Terminali / Akıllı Cihazlar",
    quantity: 1,
    selectedModel: "İşletme Tarafından Sağlanan Mobil Cihazlar (Android / iOS)",
    specs: "Yalnızca yerel Wi-Fi'a bağlanan, modern PWA mobil istemcisi; masa/sipariş seçimi ve anlık bildirim",
    unitPriceTl: 0,
    totalPriceTl: 0,
    pilotStatus: "PWA çevrimdışı önbellek ve yerel ağ ile tam ekran çalışma (İşletme envanterinden)",
  },
  {
    category: "Termal Adisyon Yazıcısı (80mm)",
    quantity: 1,
    selectedModel: "Epson TM-T20III USB (Model 011)",
    specs: "Kasa yanında yer alan masa servis dökümü yazıcısı, USB doğrudan kasaya bağlı, GS V kısmi kesim, fiyatsız servis dökümü",
    unitPriceTl: 7722,
    totalPriceTl: 7722,
    pilotStatus: "Doğrudan USB bağlantılı, fiyatsız masa servis özeti dökümü",
  },
  {
    category: "Termal Mutfak Yazıcısı (80mm Ethernet)",
    quantity: 1,
    selectedModel: "Epson TM-T20III Ethernet (C31CH51012) / Bixolon SRP-350III Ethernet",
    specs: "Mutfak hazırlık istasyonuna bağlı, dahili 10/100 RJ45 Ethernet portlu, sesli ikaz ziline sahip dayanıklı fiş yazıcısı (Port 9100 RAW)",
    unitPriceTl: 8250,
    totalPriceTl: 8250,
    pilotStatus: "Dahili Ethernet portlu, sesli ikaz zilli endüstriyel mutfak hazırlık ve iptal dökümü",
  },
  {
    category: "Salon Tavan All-in-One Router & Wi-Fi 6 AP",
    quantity: 1,
    selectedModel: "Keenetic Voyager Pro KN-3510 (AX1800) / MikroTik cAP ax",
    specs: "Tavana monte estetik kubbe formunda, dahili Gigabit Router ve bağımsız DHCP sunucusu barındıran kurumsal Wi-Fi 6 erişim noktası. Kasa arkasında harici router ihtiyacını ortadan kaldırır. 2x Gigabit LAN (PoE Girişli), 360° tavan kapsama",
    unitPriceTl: 3750,
    totalPriceTl: 3750,
    pilotStatus: "Hem kapalı LAN DHCP yönlendiricisi hem tüm salonun ana Wi-Fi 6 vericisi",
  },
  {
    category: "Kasa Yanı Gigabit PoE+ Enjektör",
    quantity: 1,
    selectedModel: "Keenetic / TP-Link TL-POE160S (Gigabit 802.3at 30W)",
    specs: "Kasa arkasında mini adaptör boyutunda çalışır; kasadan çıkan tek CAT6 kabloya elektrik basarak tavandaki Voyager Pro'yu besler (Tavanda 220V priz ihtiyacını sıfırlar)",
    unitPriceTl: 590,
    totalPriceTl: 590,
    pilotStatus: "Tavana tek kablo üzerinden veri ve elektrik (PoE) iletimi",
  },
  {
    category: "Mutfak Kablosuz Mesh Access Point / Köprü",
    quantity: 1,
    selectedModel: "Keenetic Orbiter Pro KN-3610 / Buddy 6 (veya Keenetic Mesh Node)",
    specs: "Mutfak servis bankosuna bağlı, salondaki tavan Voyager Pro'ya 5 GHz kablosuz mesh ile bağlı (mutfaktan kasaya sıfır kablo çekimi), Ethernet çıkışı mutfak yazıcısına bağlı",
    unitPriceTl: 2850,
    totalPriceTl: 2850,
    pilotStatus: "Salondan mutfağa kablosuz 5 GHz köprü ve mutfak yazıcısına dahili Ethernet bağlantısı",
  },
];

export const HARDWARE_PACKAGE_TOTAL_TL = 60942;

export type {
  Role,
  TableOperationalStatus,
  ServiceSessionStatus,
  RoundStatus,
  ItemStatus,
  CancelRequestStatus,
  PrintJobType,
  PrintJobStatus,
  BackupTargetType,
  DiagnosticStatus,
};
