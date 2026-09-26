import fs from "node:fs";
const P = "D:/merit/alacarte/_e2elib.ts";
let lines = fs.readFileSync(P, "utf8").split("\r\n");
const start = lines.findIndex(l => l.startsWith("export async function target()"));
let end = -1;
let derinlik = 0;
for (let i = start; i < lines.length; i++) {
  if (lines[i] === "}") { end = i; break; }
  if (lines[i].trim() === "}") { break; }
}
const yeni = [
  "export async function target(): Promise<any> {",
  "  for (let i = 0; i < 40; i++) {",
  "    try {",
  "      const r = await fetch(\"http://localhost:9222/json/list\");",
  "      const l = (await r.json()) as any[];",
  "      const p = l.filter((t) => t.type === \"page\" && t.webSocketDebuggerUrl).pop();",
  "      if (p) return p;",
  "    } catch {}",
  "    await sleep(600);",
  "  }",
  "  throw new Error(\"CDP hazir degil\");",
  "}",
];
lines = lines.slice(0, start).concat(yeni, lines.slice(end + 1));
let s = lines.join("\r\n");
// WebSocket acilma zaman asimi ekle
s = s.replace(
  "    await new Promise((res, rej) => { ws.addEventListener(\"open\", () => res(null), { once: true }); ws.addEventListener(\"error\", () => rej(new Error(\"ws hata\")), { once: true }); });",
  "    await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error(\"ws acilma zaman asimi\")), 15000); ws.addEventListener(\"open\", () => { clearTimeout(t); res(null); }, { once: true }); ws.addEventListener(\"error\", () => { clearTimeout(t); rej(new Error(\"ws hata\")); }, { once: true }); });"
);
fs.writeFileSync(P, s, "utf8");
console.log("target() sadelestirildi, ws zaman asimi eklendi");