import { ensureChrome, target, CDP, BASE, sleep, log } from "./_e2elib";

let pass = 0, fail = 0;
function ok(n: string, c: boolean, e = "") { if (c) { pass++; log("   [GECTI] " + n); } else { fail++; log("   [KALDI] " + n + (e ? " -> " + e : "")); } }

async function main() {
  ensureChrome();
  const p = await target();
  const c = await CDP.connect(p.webSocketDebuggerUrl);
  await c.send("Page.enable");
  await c.send("Runtime.enable");

  log("");
  log("=== ARAMA + SERVIS NOTU TANI (Steak House) ===");
  await c.goto(BASE + "/login", 3000);
  await c.eval("localStorage.clear()");
  const path = await c.login("ahmet", "1234");
  log("   giris: " + path);
  await sleep(2000);
  await c.clickText("The Steak House");
  await sleep(4000);
  await c.clickText("Diamond Prime VIP");
  await sleep(4000);

  const menuSayisi = await c.eval("document.querySelectorAll('button').length");
  log("   toplam buton: " + menuSayisi);

  // Kategori agacindaki urunleri dogrudan dene
  const r = await c.eval("(() => { const i=document.querySelector(\"input[placeholder*='Yemek']\"); if(!i) return 'INPUT-YOK'; const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(i),'value'); d.set.call(i,'Kemik'); i.dispatchEvent(new Event('input',{bubbles:true})); return 'yazildi:'+i.value; })()");
  log("   arama yazimi: " + r);
  await sleep(3000);
  const val = await c.eval("document.querySelector(\"input[placeholder*='Yemek']\").value");
  log("   input degeri: '" + val + "'");
  const kemikVar = await c.has("Kemik");
  log("   'Kemik' metni sayfada: " + kemikVar);
  const bosMu = await c.has("bulunam");
  log("   'bulunamadi' mesaji: " + bosMu);
  const kartlar = await c.eval("[...document.querySelectorAll('h3,h4')].map(e=>e.innerText.trim()).filter(t=>t.length>3).slice(0,12).join(' | ')");
  log("   basliklar: " + kartlar);
  await c.shot("t45-arama-sonrasi");

  log("");
  log("=== SONUC: " + pass + " gecti, " + fail + " kaldi ===");
  process.exit(0);
}
main();