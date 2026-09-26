import fs from "node:fs";
const P = "D:/merit/alacarte/_e2elib.ts";
let lines = fs.readFileSync(P, "utf8").split("\r\n");
const start = lines.findIndex(l => l.startsWith("export async function target()"));
if (start < 0) { console.error("baslangic yok"); process.exit(1); }
let end = -1;
for (let i = start; i < lines.length; i++) { if (lines[i].trim() === "}") { end = i; break; } }
if (end < 0) { console.error("bitis yok"); process.exit(1); }
const yeni = [
  "export async function target(): Promise<any> {",
  "  for (let i = 0; i < 40; i++) {",
  "    try {",
  "      const lr = await fetch(\"http://localhost:9222/json/list\");",
  "      const list = (await lr.json()) as any[];",
  "      const pages = list.filter((t) => t.type === \"page\");",
  "      for (const pg of pages) {",
  "        if (!pg.url || pg.url === \"about:blank\") {",
  "          try { await fetch(\"http://localhost:9222/json/close/\" + pg.id); } catch {}",
  "        }",
  "      }",
  "      try {",
  "        const nr = await fetch(\"http://localhost:9222/json/new?about:blank\", { method: \"PUT\" });",
  "        const nt = await nr.json();",
  "        if (nt && nt.webSocketDebuggerUrl) return nt;",
  "      } catch {}",
  "      const r2 = await fetch(\"http://localhost:9222/json/list\");",
  "      const l2 = (await r2.json()) as any[];",
  "      const p = l2.filter((t) => t.type === \"page\" && t.webSocketDebuggerUrl).pop();",
  "      if (p) return p;",
  "    } catch {}",
  "    await sleep(600);",
  "  }",
  "  throw new Error(\"CDP hazir degil\");",
  "}",
];
lines = lines.slice(0, start).concat(yeni, lines.slice(end + 1));
fs.writeFileSync(P, lines.join("\r\n"), "utf8");
console.log("target() guncellendi (" + (start + 1) + "-" + (end + 1) + ")");