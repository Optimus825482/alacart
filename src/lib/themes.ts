export interface RestaurantTheme {
  name: string;
  code: string;
  subtitle: string;
  primaryColor: string;
  gradient: string;
  bgDark: string;
  cardBg: string;
  border: string;
  textAccent: string;
  badge: string;
  glow: string;
  iconEmoji: string;
}

export const RESTAURANT_THEMES: Record<string, RestaurantTheme> = {
  ROOF_GARDEN: {
    name: "The Roof Garden",
    code: "ROOF_GARDEN",
    subtitle: "Panoramik Manzara & Uluslararası Gurme Lezzetler",
    primaryColor: "#10b981",
    gradient: "from-emerald-600 via-teal-500 to-emerald-800",
    bgDark: "bg-[#061410]",
    cardBg: "bg-[#0a1f1a]/80",
    border: "border-emerald-500/40",
    textAccent: "text-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    glow: "shadow-emerald-500/20",
    iconEmoji: "🌿",
  },
  STEAK_HOUSE: {
    name: "The Steak House",
    code: "STEAK_HOUSE",
    subtitle: "Dry-Aged Seçkin Etler & Odun Ateşinde Izgara",
    primaryColor: "#ef4444",
    gradient: "from-amber-600 via-red-600 to-rose-900",
    bgDark: "bg-[#180a0a]",
    cardBg: "bg-[#241010]/80",
    border: "border-rose-500/40",
    textAccent: "text-rose-400",
    badge: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    glow: "shadow-rose-500/20",
    iconEmoji: "🥩",
  },
  BLUE_SEA: {
    name: "Blue Sea",
    code: "BLUE_SEA",
    subtitle: "Taze Akdeniz & Ege Deniz Mahsulleri",
    primaryColor: "#06b6d4",
    gradient: "from-cyan-600 via-sky-500 to-blue-800",
    bgDark: "bg-[#06121a]",
    cardBg: "bg-[#0a1e2b]/80",
    border: "border-cyan-500/40",
    textAccent: "text-cyan-400",
    badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    glow: "shadow-cyan-500/20",
    iconEmoji: "🐟",
  },
  MANDARIN: {
    name: "Mandarin",
    code: "MANDARIN",
    subtitle: "Uzakdoğu Mutfağı, Sushi Bar & Wok Uzmanlığı",
    primaryColor: "#e11d48",
    gradient: "from-rose-600 via-red-600 to-amber-600",
    bgDark: "bg-[#19080c]",
    cardBg: "bg-[#260e14]/80",
    border: "border-red-500/40",
    textAccent: "text-red-400",
    badge: "bg-red-500/15 text-amber-300 border-red-500/30",
    glow: "shadow-red-500/20",
    iconEmoji: "🥢",
  },
  BELLA_MERIT: {
    name: "Bella Merit",
    code: "BELLA_MERIT",
    subtitle: "Geleneksel İtalyan Mutfağı & Taze El Yapımı Makarnalar",
    primaryColor: "#f97316",
    gradient: "from-orange-600 via-amber-500 to-yellow-700",
    bgDark: "bg-[#170e06]",
    cardBg: "bg-[#26180c]/80",
    border: "border-orange-500/40",
    textAccent: "text-orange-400",
    badge: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    glow: "shadow-orange-500/20",
    iconEmoji: "🍝",
  },
};

export function getRestaurantTheme(codeOrThemeKey?: string | null): RestaurantTheme {
  if (!codeOrThemeKey) return RESTAURANT_THEMES.ROOF_GARDEN;
  const normalized = codeOrThemeKey.toLowerCase().replace(/\s+/g, "");
  const key = Object.keys(RESTAURANT_THEMES).find(
    (k) =>
      k.toLowerCase() === normalized ||
      RESTAURANT_THEMES[k].code.toLowerCase() === normalized ||
      RESTAURANT_THEMES[k].name.toLowerCase().replace(/\s+/g, "") === normalized
  );
  return key ? RESTAURANT_THEMES[key] : RESTAURANT_THEMES.ROOF_GARDEN;
}
