import fs from "node:fs";
const P = "D:/merit/alacarte/_ta.ts";
let s = fs.readFileSync(P, "utf8");
const d = [
  // arama: once input'un var olmasini bekle
  ['  const yaz = await c.eval("(()=>{const i=document.querySelector(\\"input[placeholder*=\'Yemek\']\\");',
   '  await c.waitFor("document.querySelector(\\"input[placeholder*=\'Yemek\']\\")!==null", 25000);\n  const yaz = await c.eval("(()=>{const i=document.querySelector(\\"input[placeholder*=\'Yemek\']\\");'],
  // Siparislerim: yukleme bitene kadar bekle
  ['  const liste = await c.waitForText("Bug\\u00fcn verdi\\u011finiz", 15000);\n  ok("Siparislerim listesi acildi", liste);',
   '  const liste = await c.waitForText("Bug\\u00fcn verdi\\u011finiz", 15000);\n  ok("Siparislerim listesi acildi", liste);\n  const bitti = await c.waitFor("(document.body.textContent||\'\').indexOf(\'Sipari\\u015fleriniz y\\u00fckleniyor\')===-1", 25000);\n  ok("Siparis listesi yuklendi", bitti);\n  await sleep(1500);'],
  // Siparis no regex: 3 haneli olabilir
  ['/#(\\\\d+)/', '/#(\\\\d{1,6})/'],
];
for (const [a, b] of d) {
  if (!s.includes(a)) { console.error("BULUNAMADI: " + a.slice(0, 60)); process.exit(1); }
  s = s.split(a).join(b);
}
fs.writeFileSync(P, s, "utf8");
console.log("[OK] _ta.ts zamanlama duzeltildi");