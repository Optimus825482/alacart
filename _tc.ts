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
  log("=== MUTFAK: IPTAL EDILENLER FILTRESI (The Steak House) ===");
  await c.goto(BASE + "/login", 3000);
  await c.eval("localStorage.clear()");
  const path = await c.login("mutfak.steakhouse", "1234");
  ok("Alakart bazli mutfak girisi (/kitchen)", path === "/kitchen", path);
  await sleep(3500);
  await c.blockPrint();

  const body0 = await c.text();
  ok("Mutfak ekrani acildi", body0.indexOf("MUTFAK") > -1 || body0.indexOf("Mutfak") > -1, body0.slice(0, 120).replace(/\n/g, " | "));
  ok("Alakart otomatik: The Steak House", body0.indexOf("The Steak House") > -1);
  ok("ALAKART SECIM EKRANI YOK (mutfakta olmamali)", body0.indexOf("Hangi Alakartta G\u00f6revlisiniz") === -1);

  log("");
  log("[1] Filtre sekmeleri");
  const sekmeler = await c.eval("[...document.querySelectorAll('button')].map(b=>(b.textContent||'').trim()).filter(t=>t.length>1&&t.length<45).join(' | ')");
  log("   sekmeler: " + sekmeler);
  ok("'Iptal Edilenler' sekmesi var", sekmeler.indexOf("\u0130ptal Edilenler") > -1, sekmeler);
  ok("Aktif Siparisler sekmesi var", sekmeler.indexOf("Aktif") > -1 || sekmeler.indexOf("Bekleyenler") > -1);
  ok("Tumu sekmesi var", sekmeler.indexOf("T\u00fcm\u00fc") > -1 || sekmeler.indexOf("Tümü") > -1);

  log("");
  log("[2] 'Iptal Edilenler' sekmesine tiklaniyor");
  await c.clickText("\u0130ptal Edilenler");
  await sleep(2500);
  const body1 = await c.text();
  ok("#8 iptal siparisi listede", body1.indexOf("#8") > -1, body1.slice(0, 160).replace(/\n/g, " | "));
  ok("'Iptal Edildi' rozeti gorunuyor", body1.indexOf("\u0130ptal Edildi") > -1);
  ok("'HAZIRLAMAYIN' uyarisi gorunuyor", body1.indexOf("HAZIRLAMAYIN") > -1, body1.slice(0, 200).replace(/\n/g, " | "));
  const hazirBtn = await c.eval("[...document.querySelectorAll('button')].filter(b=>/Haz\u0131rlan\u0131d\u0131|Tamamland\u0131/.test((b.textContent||''))).length");
  ok("Hazirlandi/Tamamlandi butonlari YOK", hazirBtn === 0, String(hazirBtn));
  await c.shot("t80-mutfak-iptal-edilenler");

  log("");
  log("[3] Iptal siparisinin detayi");
  await c.clickText("#8");
  await sleep(2000);
  const body2 = await c.text();
  ok("Iptal detayi acildi", body2.indexOf("S\u0130PAR\u0130\u015e \u0130PTAL ED\u0130LD\u0130") > -1 || body2.indexOf("HAZIRLAMAYIN") > -1);
  await c.shot("t81-mutfak-iptal-detay");

  log("");
  log("=== SONUC: " + pass + " gecti, " + fail + " kaldi ===");
  process.exit(fail > 0 ? 1 : 0);
}
main();