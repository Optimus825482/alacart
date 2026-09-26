import fs from "node:fs";
function load(p) { const raw = fs.readFileSync(p, "utf8"); const crlf = raw.indexOf("\r\n") > -1; return { lines: raw.split(crlf ? "\r\n" : "\n"), sep: crlf ? "\r\n" : "\n" }; }
function save(p, lines, sep) { fs.writeFileSync(p, lines.join(sep), "utf8"); }

const P = "D:/merit/alacarte/src/app/kitchen/page.tsx";
const o = load(P); let L = o.lines;

// 1) Rol yetkilerini turet (currentTheme taniminin bulundugu yere ekle)
const temaIdx = L.findIndex(l => l.includes("const currentTheme = getRestaurantTheme(session?.activeRestaurantName);"));
if (temaIdx < 0) { console.error("currentTheme bulunamadi"); process.exit(1); }
L.splice(temaIdx + 1, 0,
  "  // Rol bazli mutfak yetkileri:",
  "  //   KITCHEN_STATUS_ROLES -> Hazirlaniyor / Tamamlandi isaretlemesi (KITCHEN, ADMIN)",
  "  //   ORDER_CANCEL_ROLES   -> Iptal (KITCHEN, CHEF, ADMIN)",
  "  // Sef canli akisi izler ve iptal edebilir, ancak hazirlik/tamamlama",
  "  // isaretlemesi YAPAMAZ (sunucu tarafi da zaten engelliyor).",
  "  const canUpdateStatus = session?.role === \"KITCHEN\" || session?.role === \"ADMIN\";",
  "  const canCancelOrder =",
  "    session?.role === \"KITCHEN\" || session?.role === \"CHEF\" || session?.role === \"ADMIN\";"
);
console.log("[OK] canUpdateStatus / canCancelOrder eklendi");

// 2) "Hazirlaniyor" butonu -> canUpdateStatus ile sar
const hz = L.findIndex(l => l.trim() === '{order.status === "PENDING" && (');
if (hz < 0) { console.error("PENDING blogu bulunamadi"); process.exit(1); }
L[hz] = "                        {canUpdateStatus && order.status === \"PENDING\" && (";
console.log("[OK] 'Hazirlaniyor' butonu canUpdateStatus ile korundu");

// 3) "Tamamlandi" butonu / Geri Al butonu
const tamIdx = L.findIndex((l, i) => i > hz && l.trim() === "{!isCompleted ? (");
if (tamIdx < 0) { console.error("isCompleted blogu bulunamadi"); process.exit(1); }
L[tamIdx] = "                        {!isCompleted ? (";
// Tamamlandi butonunu sarmala: 730-736 -> icerik
const btnStart = L.findIndex((l, i) => i > tamIdx && l.includes("onClick={() => handleUpdateStatus(order.id, \"COMPLETED\")}"));
if (btnStart < 0) { console.error("COMPLETED butonu bulunamadi"); process.exit(1); }
const btnEnd = L.findIndex((l, i) => i > btnStart && l.trim() === "</button>");
if (btnEnd < 0) { console.error("COMPLETED butonu bitisi bulunamadi"); process.exit(1); }
L.splice(btnStart, 0, "                        {canUpdateStatus && (");
L.splice(btnEnd + 2, 0, "                        )}");
console.log("[OK] 'Tamamlandi' butonu canUpdateStatus ile korundu");

save(P, L, o.sep);
console.log("kitchen/page.tsx yazildi");