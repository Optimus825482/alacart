/**
 * Isletme (restoran) tarih araligi cozumleyici.
 *
 * Sunucu ve tarayici saat dilimleri farkli olabilir (Docker/Coolify sunuculari
 * genelde UTC calisir). "Belirli bir gun" raporunda 00:00-23:59 araligi isletme
 * saat dilimine gore kurulmazsa, gece yarisi siparisleri yanlis gunun raporuna duser.
 *
 * Bu modul sunucu ve istemci tarafindan guvenle kullanilabilir; server-only import icermez.
 */

const DEFAULT_BUSINESS_TIMEZONE = "Europe/Istanbul";

export function getBusinessTimezone(): string {
  const explicit =
    process.env.NEXT_PUBLIC_BUSINESS_TIMEZONE || process.env.BUSINESS_TIMEZONE || "";
  return explicit.trim() || DEFAULT_BUSINESS_TIMEZONE;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/** Verilen an icin saat diliminin UTC'ye gore farkini (ms) dondurur. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return asUtc - instant.getTime();
}

/** "YYYY-MM-DD" + gun ici konum -> gercek UTC an. */
export function zonedBoundaryToUtc(
  dateStr: string,
  timeZone: string,
  edge: "start" | "end"
): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const boundary =
    edge === "start"
      ? { hour: 0, minute: 0, second: 0, ms: 0 }
      : { hour: 23, minute: 59, second: 59, ms: 999 };

  const wallClockUtc = Date.UTC(
    year,
    month - 1,
    day,
    boundary.hour,
    boundary.minute,
    boundary.second,
    boundary.ms
  );

  // Iki gecisli cozumleme, yaz saati sinirlarinda da dogru ofseti bulur.
  let offset = zoneOffsetMs(new Date(wallClockUtc), timeZone);
  let result = wallClockUtc - offset;
  offset = zoneOffsetMs(new Date(result), timeZone);
  result = wallClockUtc - offset;
  return new Date(result);
}

export type ResolvedDateRange =
  | { ok: true; start: Date; end: Date; timeZone: string; dayCount: number }
  | { ok: false; error: string };

export function resolveDateRange(
  startDate?: string | null,
  endDate?: string | null
): ResolvedDateRange {
  const timeZone = getBusinessTimezone();
  const today = todayInTimeZone(timeZone);

  const startStr = (startDate || today).trim();
  const endStr = (endDate || today).trim();

  if (!isValidDateString(startStr)) {
    return { ok: false, error: "Baslangic tarihi gecersiz." };
  }
  if (!isValidDateString(endStr)) {
    return { ok: false, error: "Bitis tarihi gecersiz." };
  }
  if (startStr > endStr) {
    return { ok: false, error: "Baslangic tarihi, bitis tarihinden sonra olamaz." };
  }

  const start = zonedBoundaryToUtc(startStr, timeZone, "start");
  const end = zonedBoundaryToUtc(endStr, timeZone, "end");
  const dayCount =
    Math.round(
      (zonedBoundaryToUtc(endStr, timeZone, "start").getTime() -
        zonedBoundaryToUtc(startStr, timeZone, "start").getTime()) /
        (24 * 60 * 60 * 1000)
    ) + 1;

  return { ok: true, start, end, timeZone, dayCount };
}

export function todayInTimeZone(timeZone: string = getBusinessTimezone()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function formatInTimeZone(
  value: string | Date,
  timeZone: string = getBusinessTimezone()
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone,
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export function formatDateInTimeZone(
  value: string | Date,
  timeZone: string = getBusinessTimezone()
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone,
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Rapor ust bilgisinde kullanilan tarih araligi etiketi. */
export function describeDateRange(
  startDate: string,
  endDate: string,
  timeZone: string = getBusinessTimezone()
): string {
  if (startDate === endDate) {
    return formatDateInTimeZone(zonedBoundaryToUtc(startDate, timeZone, "start"), timeZone);
  }
  const from = formatDateInTimeZone(zonedBoundaryToUtc(startDate, timeZone, "start"), timeZone);
  const to = formatDateInTimeZone(zonedBoundaryToUtc(endDate, timeZone, "start"), timeZone);
  return `${from} - ${to}`;
}
