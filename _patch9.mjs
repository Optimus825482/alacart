import fs from "node:fs";
const P = "D:/merit/alacarte/_e2elib.ts";
let s = fs.readFileSync(P, "utf8");
const eski = "const r = await this.eval(\"(() => { const el=[...document.querySelectorAll('button,a')].filter(x=>{const t=(x.innerText||'').trim(); return \" + cond + \";}).pop(); if(!el) return 'YOK'; el.click(); return 'TIKLANDI: ' + el.innerText.trim().replace(/\\\\n/g,' ').slice(0,45); })()\");";
const yeni = "const r = await this.eval(\"(() => { const el=[...document.querySelectorAll('button,a')].filter(x=>{const t=(x.textContent||'').trim(); return \" + cond + \";}).pop(); if(!el) return 'YOK'; el.click(); return 'TIKLANDI: ' + (el.innerText||'').trim().replace(/\\\\n/g,' ').slice(0,45); })()\");";
if (!s.includes(eski)) { console.error("clickText govdesi bulunamadi"); process.exit(1); }
s = s.replace(eski, yeni);
fs.writeFileSync(P, s, "utf8");
console.log("[OK] clickText textContent tabanli yapildi");