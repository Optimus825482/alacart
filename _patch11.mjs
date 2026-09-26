import fs from "node:fs";
const P = "D:/merit/alacarte/_t8.ts";
let s = fs.readFileSync(P, "utf8");
const degisimler = [
  ['await c.clickText("Onayla & G\\u00f6nder", false);', 'await c.clickText("MUTFA\\u011eA G\\u00d6NDER", false);'],
  ['  await c.clickText("Diamond Prime VIP");\n  await sleep(4000);', '  await c.clickText("Diamond Prime VIP");\n  await sleep(5500);'],
  ['  await sleep(2500);\n  const urunAdi', '  await sleep(3500);\n  const urunAdi'],
];
for (const [a, b] of degisimler) {
  if (!s.includes(a)) { console.error("BULUNAMADI: " + a.slice(0, 55)); process.exit(1); }
  s = s.split(a).join(b);
}
fs.writeFileSync(P, s, "utf8");
console.log("[OK] _t8.ts duzeltildi");