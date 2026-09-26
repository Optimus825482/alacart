import fs from "node:fs";
const P = "D:/merit/alacarte/_e2elib.ts";
let s = fs.readFileSync(P, "utf8");
if (s.includes("async waitForText(")) { console.log("zaten var"); process.exit(0); }
const anchor = "  async hasText(t: string): Promise<boolean> { return this.eval(\"(document.body.textContent||'').indexOf(\" + JSON.stringify(t) + \")>-1\"); }";
if (!s.includes(anchor)) { console.error("anchor yok"); process.exit(1); }
const ek = [
  "",
  "  // Kosul gerceklesene kadar bekle (flaky olmamak icin)",
  "  async waitFor(expr: string, ms = 20000, label = \"kosul\"): Promise<boolean> {",
  "    const bas = Date.now();",
  "    while (Date.now() - bas < ms) {",
  "      try { if (await this.eval(\"!!(\" + expr + \")\")) return true; } catch {}",
  "      await sleep(400);",
  "    }",
  "    log(\"      [BEKLEME ZAMAN ASMISI] \" + label);",
  "    return false;",
  "  }",
  "",
  "  async waitForText(t: string, ms = 20000): Promise<boolean> {",
  "    return this.waitFor(\"(document.body.textContent||'').indexOf(\" + JSON.stringify(t) + \")>-1\", ms, \"metin: \" + t);",
  "  }",
  "",
  "  async waitForPath(p: string, ms = 20000): Promise<boolean> {",
  "    return this.waitFor(\"location.pathname===\" + JSON.stringify(p), ms, \"yol: \" + p);",
  "  }",
].join("\n");
s = s.replace(anchor, anchor + "\n" + ek);
fs.writeFileSync(P, s, "utf8");
console.log("[OK] waitFor eklendi");