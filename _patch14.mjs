import fs from "node:fs";
const P = "D:/merit/alacarte/_e2elib.ts";
let s = fs.readFileSync(P, "utf8");
const eski = "  async clickText(txt: string, exact = false): Promise<boolean> {";
const i = s.indexOf(eski);
if (i < 0) { console.error("clickText yok"); process.exit(1); }
const j = s.indexOf("\n  }\n", i);
if (j < 0) { console.error("clickText bitisi yok"); process.exit(1); }
const yeni = [
  "  async clickText(txt: string, exact = false): Promise<boolean> {",
  "    const cond = exact",
  "      ? \"(t === \" + JSON.stringify(txt) + \")\"",
  "      : \"(t.indexOf(\" + JSON.stringify(txt) + \") > -1)\";",
  "    // TIKLANABILIR butun ogeleri tara (button, a, role=button, div, span)",
  "    // ve eslesenler arasinda EN KISA textContent olana tikla (en icteki oge).",
  "    // Tiklama olayi React'te yukari dogru yayildigi icin bu, kartin",
  "    // ustundeki onClick'i de tetikler.",
  "    const js = [",
  "      \"(() => {\",",
  "      \"  const sel = 'button,a,[role=button],[onclick],div,span,li,td';\",",
  "      \"  const cand = [...document.querySelectorAll(sel)].filter(x => {\",",
  "      \"    const t = (x.textContent || '').trim();\",",
  "      \"    if (!t) return false;\",",
  "      \"    if (x.querySelector(sel)) { const p = x.parentElement; if (p && (p.textContent||'').trim() === t) return true; }\",",
  "      \"    return \" + cond + \";\",",
  "      \"  });\",",
  "      \"  if (!cand.length) return 'YOK';\",",
  "      \"  cand.sort((a,b) => (a.textContent||'').length - (b.textContent||'').length);\",",
  "      \"  const el = cand[0];\",",
  "      \"  el.click();\",",
  "      \"  return 'TIKLANDI: ' + (el.innerText||'').trim().replace(/\\\\n/g,' ').slice(0,45);\",",
  "      \"})()\",",
  "    ].join(\"\\n\");",
  "    const r = await this.eval(js);",
  "    log(\"      \" + r);",
  "    return r !== \"YOK\";",
  "  }",
].join("\n");
s = s.slice(0, i) + yeni + s.slice(j + 4);
fs.writeFileSync(P, s, "utf8");
console.log("[OK] clickText genisletildi");