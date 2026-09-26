import fs from "node:fs";
const P = "D:/merit/alacarte/_e2elib.ts";
let s = fs.readFileSync(P, "utf8");
const eski = [
  "  async shot(n: string) {",
  "    const r = await this.send(\"Page.captureScreenshot\", { format: \"png\" });",
  "    fs.writeFileSync(DEST + \"\\\\\" + n + \".png\", Buffer.from(r.data, \"base64\"));",
  "    log(\"      [goruntu] \" + n + \".png\");",
  "  }",
].join("\n");
const yeni = [
  "  async shot(n: string) {",
  "    try {",
  "      const r = await this.send(\"Page.captureScreenshot\", { format: \"png\", captureBeyondViewport: false }, 60000);",
  "      fs.writeFileSync(DEST + \"\\\\\" + n + \".png\", Buffer.from(r.data, \"base64\"));",
  "      log(\"      [goruntu] \" + n + \".png\");",
  "    } catch (e: any) {",
  "      log(\"      [goruntu alinamadi] \" + n + \" (\" + e.message + \")\");",
  "    }",
  "  }",
].join("\n");
if (!s.includes(eski)) { console.error("shot blogu bulunamadi"); process.exit(1); }
s = s.replace(eski, yeni);
// send() opsiyonel zaman asimi parametresi
s = s.replace(
  "  send(method: string, params: any = {}) {\n    const id = ++this.id;\n    return new Promise<any>((res, rej) => {\n      const t = setTimeout(() => { this.pending.delete(id); rej(new Error(method + \" zaman asimi\")); }, 30000);",
  "  send(method: string, params: any = {}, timeoutMs = 30000) {\n    const id = ++this.id;\n    return new Promise<any>((res, rej) => {\n      const t = setTimeout(() => { this.pending.delete(id); rej(new Error(method + \" zaman asimi\")); }, timeoutMs);"
);
fs.writeFileSync(P, s, "utf8");
console.log("[OK] shot hata toleransli, send zaman asimi parametreli");