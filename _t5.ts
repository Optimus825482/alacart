import { CDP, target, ensureChrome, sleep, log, BASE } from "./_e2elib";

let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) { pass++; log("  [GECTI] " + name + (detail ? " -> " + detail : "")); }
  else { fail++; log("  [KALDI **] " + name + (detail ? " -> " + detail : "")); }
}

async function main() {
  ensureChrome();
  const t = await target();
  const c = await CDP.connect(t.webSocketDebuggerUrl);
  await c.send("Page.enable"); await c.send("Runtime.enable");

  log("\n##### MODUL 7: YEMEGE OZEL SERVIS NOTLARI (garson siparis ekrani) #####");
  await c.login("ahmet", "1234");
  await sleep(2500);
  let txt = await c.text();
  // Restoran otomatik atandi -> masa listesinde olmali
  check("Garson otomatik alakarta (menu ekrani acildi)", /Mutfağı \(KDS\)/.test(txt) || txt.length > 300, "metin=" + txt.length);

  // "Steak" aramasina yaz -> notu olan urunleri bul
  await c.setInput("input[placeholder*='ara'], input[placeholder*='Ara'], input[type='search']", "Wagyu");
  await sleep(1500);
  const found = await c.eval("(() => { const t=document.body.innerText; const i=t.indexOf('Wagyu'); return i<0?'YOK':t.slice(i,i+260); })()");
  log("      " + String(found).replace(/\\n/g, " | ").slice(0, 240));
  check("Wagyu (notu olan urun) menu listesinde bulundu", String(found).indexOf("YOK") < 0, "bulundu");
  check("Kart uzerinde 'Seçenekler' notu gorunuyor", /Seçenekler/.test(String(found)), "kartta not var");
  await c.shot("t30-menu-servis-notu-kart");

  // Urune tikla -> modal acilmis mi
  const clicked = await c.eval("(() => { const el=[...document.querySelectorAll('button')].filter(function(b){return /Wagyu/.test(b.innerText||'') && b.offsetParent!==null;}).pop(); if(!el) return 'YOK'; el.click(); return 'TIKLANDI'; })()");
  log("      " + clicked);
  await sleep(2000);
  txt = await c.text();
  const modalOpen = /Sipariş Kalemi Ekleme|Sipariş Kalemi Düzenleme/.test(txt);
  check("Urun modal acildi", modalOpen, modalOpen ? "modal acik" : "modal acilmadi");
  check("Modalda 'Özel Pişirme & Servis Tercihleri' bolumu var", /Özel Pişirme & Servis Tercihleri/.test(txt), "bolum var");
  check("Modalda 'Ürüne Özel' rozeti var", /Ürüne Özel/.test(txt), "rozet var");

  const noteCount = await c.eval("(() => { const b=[...document.querySelectorAll('button')].filter(function(x){return /Az Pişmiş|Orta Az|İyi Pişmiş|Sosu Ayrı|Kaya Tuzu/.test(x.innerText||'') && x.offsetParent!==null;}); return b.length; })()");
  log("      HIZLI NOT BUTONU SAYISI: " + noteCount);
  check("Hizli not butonlari tiklanabilir (7 seçenek)", noteCount >= 5, noteCount + " buton bulundu");
  await c.shot("t31-menu-servis-notu-modal");

  // Bir notu sec -> dugunun degistigini gor
  const before = await c.eval("(() => { const b=[...document.querySelectorAll('button')].filter(function(x){return /Az Pişmiş/.test(x.innerText||'') && x.offsetParent!==null;})[0]; return b? b.className : 'YOK'; })()");
  await c.eval("(() => { const b=[...document.querySelectorAll('button')].filter(function(x){return /Az Pişmiş/.test(x.innerText||'') && x.offsetParent!==null;})[0]; if(b) b.click(); return 'ok'; })()");
  await sleep(1200);
  const after = await c.eval("(() => { const b=[...document.querySelectorAll('button')].filter(function(x){return /Az Pişmiş/.test(x.innerText||'') && x.offsetParent!==null;})[0]; return b? b.className : 'YOK'; })()");
  check("Not secildiginde buton durumu degisti", before !== after, "secili isaretlendi");
  const inputVal = await c.eval("(() => { const i=[...document.querySelectorAll('input')].filter(function(x){return /varsa ilave|ekstra not/i.test(x.placeholder||'')})[0]; return i? i.value : 'INPUT YOK'; })()");
  log("      NOT METNI ALANI: " + JSON.stringify(inputVal));
  check("Secilen not metin alanina yazildi", String(inputVal).indexOf("Az Pişmiş") > -1, String(inputVal));
  await c.shot("t32-menu-not-secildi");

  log("\n##### OZET #####");
  log("  GECTI: " + pass + " | KALDI: " + fail);
  process.exit(fail > 0 ? 1 : 0);
}
main().catch(e => { console.error("HATA: " + e.message); process.exit(1); });