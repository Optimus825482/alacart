// E2E yardimci: CDP + tiklama + dogrulama
import { spawn } from "child_process";
import fs from "fs";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PROFILE = "C:\\Users\\erkan\\.codex\\visualizations\\2026\\09\\26\\01a0db57-e3e9-7ad0-bc14-b2f8716f6fb5\\chrome-prof";
export const BASE = "http://localhost:3000";
export const DEST = "C:\\Users\\erkan\\.codex\\visualizations\\2026\\09\\26\\01a0db57-e3e9-7ad0-bc14-b2f8716f6fb5\\alacarte-e2e";
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export const log = (...a: any[]) => console.log(...a);

let started = false;
export function ensureChrome() {
  if (started) return;
  started = true;
  if (!fs.existsSync(DEST)) fs.mkdirSync(DEST, { recursive: true });
  try {
    spawn(CHROME, ["--remote-debugging-port=9222", "--user-data-dir=" + PROFILE, "--no-first-run", "--no-default-browser-check", "--window-size=1600,1000", "about:blank"], { detached: true, stdio: "ignore" }).unref();
  } catch {}
}

export async function target(): Promise<any> {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch("http://localhost:9222/json/list");
      const l = (await r.json()) as any[];
      const p = l.filter((t) => t.type === "page" && t.webSocketDebuggerUrl).pop();
      if (p) return p;
    } catch {}
    await sleep(600);
  }
  throw new Error("CDP hazir degil");
}

export class CDP {
  ws: any;
  id = 0;
  pending = new Map<number, any>();

  static async connect(url: string) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("ws acilma zaman asimi")), 15000);
      ws.addEventListener("open", () => { clearTimeout(t); res(null); }, { once: true });
      ws.addEventListener("error", () => { clearTimeout(t); rej(new Error("ws hata")); }, { once: true });
    });
    const c = new CDP();
    c.ws = ws;
    ws.addEventListener("message", (ev: any) => {
      const m = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data));
      if (m.id && c.pending.has(m.id)) {
        const p = c.pending.get(m.id);
        c.pending.delete(m.id);
        p(m);
      }
    });
    return c;
  }

  send(method: string, params: any = {}, timeoutMs = 30000) {
    const id = ++this.id;
    return new Promise<any>((res, rej) => {
      const t = setTimeout(() => { this.pending.delete(id); rej(new Error(method + " zaman asimi")); }, timeoutMs);
      this.pending.set(id, (m: any) => { clearTimeout(t); m.error ? rej(new Error(method + ": " + JSON.stringify(m.error))) : res(m.result); });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(e: string) {
    const r = await this.send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error("JS: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  }

  async shot(n: string) {
    try {
      const r = await this.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, 60000);
      fs.writeFileSync(DEST + "\\" + n + ".png", Buffer.from(r.data, "base64"));
      log("      [goruntu] " + n + ".png");
    } catch (e: any) {
      log("      [goruntu alinamadi] " + n + " (" + e.message + ")");
    }
  }

  async goto(u: string, w = 4500) { await this.send("Page.navigate", { url: u }); await sleep(w); }

  async clickText(txt: string, exact = false): Promise<boolean> {
    // Once buton/link/role=button taranir; bulunamazsa her tur div/span icinde
    // EN ICTEKI eslesme aranir. Tiklama olayi yukari yayildigi icin kartin
    // (div onClick) ustundeki tiklama da tetiklenir.
    const js = [
      "(() => {",
      "  const t = " + JSON.stringify(txt) + ";",
      "  const hit = (x) => { const s = (x.textContent||'').trim(); return " + (exact ? "s === t" : "s.indexOf(t) > -1") + "; };",
      "  const prim = [...document.querySelectorAll('button,a,[role=button]')].filter(hit);",
      "  let el = prim.length ? prim[prim.length-1] : null;",
      "  if (!el) {",
      "    const all = [...document.querySelectorAll('div,span,li,td,p,h1,h2,h3,h4,h5')].filter(hit);",
      "    const inner = all.filter(x => ![...x.querySelectorAll('div,span,li,td,p,h1,h2,h3,h4,h5')].some(hit));",
      "    el = inner.length ? inner[0] : (all.length ? all[all.length-1] : null);",
      "  }",
      "  if (!el) return 'YOK';",
      "  el.scrollIntoView({block:'center'});",
      "  el.click();",
      "  return 'TIKLANDI: ' + (el.innerText||el.textContent||'').trim().replace(/\\n/g,' ').slice(0,45);",
      "})()",
    ].join("\n");
    const r = await this.eval(js);
    log("      " + r);
    return r !== "YOK";
  }

  async setInput(sel: string, val: string) {
    return this.eval("(() => { const el=document.querySelector(" + JSON.stringify(sel) + "); if(!el) return 'YOK'; const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value'); d.set.call(el," + JSON.stringify(val) + "); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); return 'OK'; })()");
  }

  async text(): Promise<string> { return this.eval("document.body.innerText"); }

  async has(t: string): Promise<boolean> { return this.eval("document.body.innerText.indexOf(" + JSON.stringify(t) + ")>-1"); }

  // textContent tabanli arama (kaydirma icindeki kartlari da yakalar)
  async hasText(t: string): Promise<boolean> { return this.eval("(document.body.textContent||'').indexOf(" + JSON.stringify(t) + ")>-1"); }

  // Kosul gerceklesene kadar bekle (flaky olmamak icin)
  async waitFor(expr: string, ms = 20000, label = "kosul"): Promise<boolean> {
    const bas = Date.now();
    while (Date.now() - bas < ms) {
      try { if (await this.eval("!!(" + expr + ")")) return true; } catch {}
      await sleep(400);
    }
    log("      [BEKLEME ZAMAN ASMISI] " + label);
    return false;
  }

  async waitForText(t: string, ms = 20000): Promise<boolean> {
    return this.waitFor("(document.body.textContent||'').indexOf(" + JSON.stringify(t) + ")>-1", ms, "metin: " + t);
  }

  async waitForPath(p: string, ms = 20000): Promise<boolean> {
    return this.waitFor("location.pathname===" + JSON.stringify(p), ms, "yol: " + p);
  }

  // Yazdirma dialogunu engelle (test ortami)
  async blockPrint() { return this.eval("window.print=function(){window.__printCalled=true;}; 'OK'"); }

  async tabTexts(): Promise<string> {
    return this.eval("[...document.querySelectorAll('button')].map(function(b){return (b.innerText||'').split('\\n')[0].trim()}).filter(function(x){return x.length>1&&x.length<40}).join(' | ')");
  }

  async login(user: string, pass: string) {
    await this.goto(BASE + "/login");
    await this.setInput("input[type='text'], input:not([type])", user);
    await this.setInput("input[type='password']", pass);
    await this.eval("(() => { const f=document.querySelector('form'); if(f){f.requestSubmit?f.requestSubmit():f.submit(); return 'SUBMIT';} return 'YOK'; })()");
    await sleep(5500);
    return this.eval("location.pathname");
  }
}