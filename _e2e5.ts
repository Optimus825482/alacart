import { spawn } from "child_process";
import fs from "fs";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PROFILE = "C:\\Users\\erkan\\.codex\\visualizations\\2026\\09\\26\\01a0db57-e3e9-7ad0-bc14-b2f8716f6fb5\\chrome-prof";
const BASE = "http://localhost:3000";
const DEST = "C:\\Users\\erkan\\.codex\\visualizations\\2026\\09\\26\\01a0db57-e3e9-7ad0-bc14-b2f8716f6fb5\\alacarte-e2e";
spawn(CHROME, ["--remote-debugging-port=9222", "--user-data-dir=" + PROFILE, "--no-first-run", "--no-default-browser-check", "--window-size=1600,1000", "about:blank"], { detached: true, stdio: "ignore" }).unref();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const log = (...a: any[]) => console.log(...a);
async function tgt(): Promise<any> { for (let i = 0; i < 40; i++) { try { const r = await fetch("http://localhost:9222/json/list"); const l = (await r.json()) as any[]; const p = l.find(t => t.type === "page"); if (p) return p; } catch {} await sleep(500); } throw new Error("CDP yok"); }
class CDP { ws: any; id = 0; pending = new Map<number, any>();
  static async connect(url: string) { const ws = new WebSocket(url); await new Promise((res, rej) => { ws.addEventListener("open", () => res(null), { once: true }); ws.addEventListener("error", () => rej(new Error("ws")), { once: true }); }); const c = new CDP(); c.ws = ws; ws.addEventListener("message", (ev: any) => { const m = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data)); if (m.id && c.pending.has(m.id)) { c.pending.get(m.id)!(m); c.pending.delete(m.id); } }); return c; }
  send(method: string, params: any = {}) { const id = ++this.id; return new Promise<any>((res, rej) => { this.pending.set(id, (m: any) => (m.error ? rej(new Error(method + ": " + JSON.stringify(m.error))) : res(m.result))); this.ws.send(JSON.stringify({ id, method, params })); }); }
  async eval(e: string) { const r = await this.send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error("JS: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; }
  async shot(n: string) { const r = await this.send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(DEST + "\\_shot-" + n + ".png", Buffer.from(r.data, "base64")); log("   [goruntu] _shot-" + n + ".png"); }
  async goto(u: string) { await this.send("Page.navigate", { url: u }); await sleep(4500); }
  async clickText(txt: string) { const r = await this.eval(CLICK_FN(txt)); log("   " + r); return r.indexOf("YOK") < 0; }
}
const CLICK_FN = (t: string) => "(() => { const el=[...document.querySelectorAll('button,a')].filter(x=>(x.innerText||'').indexOf(" + JSON.stringify(t) + ")>-1).pop(); if(!el) return 'YOK'; el.click(); return 'TIKLANDI: ' + el.innerText.trim().replace(/\\n/g,' ').slice(0,45); })()";
const has = (t: string) => "document.body.innerText.indexOf(" + JSON.stringify(t) + ")>-1";
const cardText = () => "[...document.querySelectorAll('button')].map(function(b){return (b.innerText||'').split('\\n').slice(0,3).join(' ')}).filter(function(x){return x.length>4}).slice(0,12).join(' || ')";
const kdsName = () => "(function(){var m=document.body.innerText.match(/Seçilen Alakart:\\s*([^\\n]+)/); return m?m[1].trim():'YOK'})()";
async function main() {
  const t = await tgt(); const c = await CDP.connect(t.webSocketDebuggerUrl);
  await c.send("Page.enable"); await c.send("Runtime.enable"); await c.send("Network.enable");

  log("=== 1) ADMIN -> /kitchen ===");
  await c.goto(BASE + "/login");
  await c.eval("(() => { const i=[...document.querySelectorAll('input')]; const set=function(el,v){const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value');d.set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));}; set(i[0],'admin'); set(i[1],'admin123'); const b=[...document.querySelectorAll('button')].find(x=>/GİRİŞ YAP|Giris Yap|giris yap|login/i.test(x.innerText)); if(b) b.click(); return 'ok'; })()");
  await sleep(5000);
  log("   yol: " + await c.eval("location.pathname"));
  await c.goto(BASE + "/kitchen");
  await sleep(3500);
  log("   secim ekrani mi: " + await c.eval(has("MUTFAK İSTASYONU SEÇİMİ")));
  log("   kartlar: " + await c.eval(cardText()));
  await c.shot("20-mutfak-kds-secim");

  log("\n=== 2) THE ROOF GARDEN MUTFAGI SEC ===");
  await c.clickText("The Roof Garden Mutfa");
  await sleep(6500);
  log("   KDS alakart: " + await c.eval(kdsName()));
  await c.shot("21-mutfak-kds");

  log("\n=== 3) 'ALAKART DEĞİŞTİR' BUTONU ===");
  log("   " + await c.eval("(() => { var b=[...document.querySelectorAll('button')].filter(x=>(x.innerText||'').indexOf('Alakart Değiştir')>-1).pop(); if(!b) return 'BUTON YOK'; var r=b.getBoundingClientRect(); return 'BUTON VAR | w=' + Math.round(r.width) + ' h=' + Math.round(r.height) + ' | disabled=' + b.disabled; })()"));
  await c.shot("22-mutfak-degistir-butonu");

  log("\n=== 4) BUTONA BAS -> SECIM EKRANI ===");
  await c.clickText("Alakart Değiştir");
  await sleep(4500);
  log("   " + (await c.eval(has("MUTFAK İSTASYONU SEÇİMİ")) ? "SECIM EKRANI DONDU [OK]" : "SECIM EKRANI DONMADI [HATA]"));
  log("   kartlar: " + await c.eval(cardText()));
  await c.shot("23-mutfak-tekrar-secim");

  log("\n=== 5) BELLA MERIT MUTFAGI SEC (farkli alakart) ===");
  await c.clickText("Bella Merit Muta");
  await sleep(6500);
  log("   KDS alakart: " + await c.eval(kdsName()));
  await c.shot("24-mutfak-bella-merit");
  process.exit(0);
}
main().catch(e => { console.error("HATA: " + e.message); process.exit(1); });