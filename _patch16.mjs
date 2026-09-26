import fs from "node:fs";
const P = "D:/merit/alacarte/_ta.ts";
let s = fs.readFileSync(P, "utf8");
const d = [
  ['ok("Navbar alakart gostergesi guncellendi", await c.waitForText("SE\\u00c7\\u0130LEN ALAKART", 8000));', 'ok("Navbar alakart gostergesi guncellendi", await c.waitForText("Se\\u00e7ilen Alakart", 8000));'],
  ['await c.clickText("Sa\\u0131r\\u0131msaks\\u0131z Ekmek");', 'await c.clickText("Sar\\u0131msaks\\u0131z Ekmek");'],
  ['notDegeri.indexOf("Sa\\u0131r\\u0131msaks\\u0131z") > -1', 'notDegeri.indexOf("Sar\\u0131msaks\\u0131z") > -1'],
  ['/Ocak Bekliyor|Haz\\u0131rlan\\u0131yor|Tamamland\\u0131|Revizyon/', '/Bekliyor|Haz\\u0131rlan\\u0131yor|Tamamland\\u0131|Revizyon/'],
  ['  const orderNo = await c.eval("(function(){var m=(document.body.textContent||\'\').match(/#(\\\\d+)/);return m?m[1]:\'\'})()");',
   '  const panelMetin = await c.eval("(document.body.textContent||\'\').slice(0,2200)");\n  log("   PANEL METNI: " + panelMetin);\n  const orderNo = await c.eval("(function(){var m=(document.body.textContent||\'\').match(/#(\\\\d+)/);return m?m[1]:\'\'})()");'],
];
for (const [a, b] of d) {
  if (!s.includes(a)) { console.error("BULUNAMADI: " + a.slice(0, 60)); process.exit(1); }
  s = s.split(a).join(b);
}
fs.writeFileSync(P, s, "utf8");
console.log("[OK] _ta.ts duzeltildi");