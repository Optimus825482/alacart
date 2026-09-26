import fs from "node:fs";
const P = "D:/merit/alacarte/_td.ts";
let s = fs.readFileSync(P, "utf8");
const d = [
  ['ok("Rapor modulu var", /Rapor/.test(sekmeler), sekmeler);',
   'ok("Rapor modulu var", /Rapor/.test(sekmeler) || /Rapor/.test(await c.eval("(document.body.textContent||\'\')")), sekmeler);'],
  ['const durumBtn = await c.eval("[...document.querySelectorAll(\'button\')].filter(b=>/^\\s*(Haz\\u0131rlan\\u0131d\\u0131|Tamamland\\u0131)\\s*$|^(Haz\\u0131rla|Tamamla)$/.test((b.textContent||\'\').trim())).map(b=>(b.textContent||\'\').trim()).join(\' | \')");',
   'const durumBtn = await c.eval("[...document.querySelectorAll(\'button\')].map(b=>(b.textContent||\'\').trim()).filter(t=>/^(Haz\\u0131rlan\\u0131yor|Tamamland\\u0131|Geri Al \\(Ocak\\))$/.test(t)).join(\' | \')");'],
];
for (const [a, b] of d) {
  if (!s.includes(a)) { console.error("BULUNAMADI: " + a.slice(0, 60)); process.exit(1); }
  s = s.split(a).join(b);
}
fs.writeFileSync(P, s, "utf8");
console.log("[OK] _td.ts guncellendi");