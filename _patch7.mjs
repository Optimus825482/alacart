import fs from "node:fs";
const P = "D:/merit/alacarte/_t6.ts";
let s = fs.readFileSync(P, "utf8");
const eski = "input[placeholder*='ara'], input[type='search']";
const yeni = "input[placeholder*='Yemek']";
if (!s.includes(eski)) { console.error("secici bulunamadi"); process.exit(1); }
s = s.split(eski).join(yeni);
fs.writeFileSync(P, s, "utf8");
console.log("[OK] arama secicisi duzeltildi");