import fs from "node:fs";
const P = "D:/merit/alacarte/_e2elib.ts";
let s = fs.readFileSync(P, "utf8");
const i = s.indexOf("  async clickText(txt: string, exact = false): Promise<boolean> {");
if (i < 0) { console.error("clickText yok"); process.exit(1); }
const j = s.indexOf("\n  }\n", i);
if (j < 0) { console.error("bitis yok"); process.exit(1); }
const yeni = [
  '  async clickText(txt: string, exact = false): Promise<boolean> {',
  '    // Once buton/link/role=button taranir; bulunamazsa her tur div/span icinde',
  '    // EN ICTEKI eslesme aranir. Tiklama olayi yukari yayildigi icin kartin',
  '    // (div onClick) ustundeki tiklama da tetiklenir.',
  '    const js = [',
  '      "(() => {",',
  '      "  const t = " + JSON.stringify(txt) + ";",',
  '      "  const hit = (x) => { const s = (x.textContent||\'\').trim(); return " + (exact ? "s === t" : "s.indexOf(t) > -1") + "; };",',
  '      "  const prim = [...document.querySelectorAll(\'button,a,[role=button]\')].filter(hit);",',
  '      "  let el = prim.length ? prim[prim.length-1] : null;",',
  '      "  if (!el) {",',
  '      "    const all = [...document.querySelectorAll(\'div,span,li,td,p,h1,h2,h3,h4,h5\')].filter(hit);",',
  '      "    const inner = all.filter(x => ![...x.querySelectorAll(\'div,span,li,td,p,h1,h2,h3,h4,h5\')].some(hit));",',
  '      "    el = inner.length ? inner[0] : (all.length ? all[all.length-1] : null);",',
  '      "  }",',
  '      "  if (!el) return \'YOK\';",',
  '      "  el.scrollIntoView({block:\'center\'});",',
  '      "  el.click();",',
  '      "  return \'TIKLANDI: \' + (el.innerText||el.textContent||\'\').trim().replace(/\\\\n/g,\' \').slice(0,45);",',
  '      "})()",',
  '    ].join("\\n");',
  '    const r = await this.eval(js);',
  '    log("      " + r);',
  '    return r !== "YOK";',
  '  }',
].join("\n");
s = s.slice(0, i) + yeni + s.slice(j + 4);
fs.writeFileSync(P, s, "utf8");
console.log("[OK] clickText yeniden yazildi");