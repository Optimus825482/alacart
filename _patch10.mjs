import fs from "node:fs";
const P = "D:/merit/alacarte/_t8.ts";
let s = fs.readFileSync(P, "utf8");
s = s.replace(
  "const urunAdi = await c.eval(\"[...document.querySelectorAll('h3,h4')].map(e=>e.innerText.trim()).filter(t=>t.indexOf('Kemik')>-1)[0]||''\");",
  "const urunAdi = await c.eval(\"[...document.querySelectorAll('h3,h4')].map(e=>(e.textContent||'').trim()).filter(t=>t.indexOf('Kemik')>-1)[0]||''\");"
);
s = s.replace('await c.clickText("Onayla & G\u00f6nder", false);', 'await c.clickText("MUTFA\u011eA G\u00d6NDER", false);');
s = s.replace('const hizli = await c.eval("[...document.querySelectorAll(\'button\')].map(b=>(b.innerText||\'\').trim())', 'const hizli = await c.eval("[...document.querySelectorAll(\'button\')].map(b=>(b.textContent||\'\').trim())');
fs.writeFileSync(P, s, "utf8");
console.log("[OK] test duzeltildi");