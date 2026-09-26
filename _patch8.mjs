import fs from "node:fs";
const P = "D:/merit/alacarte/_e2elib.ts";
let s = fs.readFileSync(P, "utf8");
if (s.includes("async hasText(")) { console.log("zaten var"); process.exit(0); }
const anchor = "  async has(t: string): Promise<boolean> { return this.eval(\"document.body.innerText.indexOf(\" + JSON.stringify(t) + \")>-1\"); }";
if (!s.includes(anchor)) { console.error("anchor yok"); process.exit(1); }
const yeni = anchor + "\n\n  // textContent tabanli arama (kaydirma icindeki kartlari da yakalar)\n  async hasText(t: string): Promise<boolean> { return this.eval(\"(document.body.textContent||'').indexOf(\" + JSON.stringify(t) + \")>-1\"); }\n\n  // Yazdirma dialogunu engelle (test ortami)\n  async blockPrint() { return this.eval(\"window.print=function(){window.__printCalled=true;}; 'OK'\"); }";
s = s.replace(anchor, yeni);
fs.writeFileSync(P, s, "utf8");
console.log("[OK] hasText + blockPrint eklendi");