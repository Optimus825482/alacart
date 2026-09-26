import { CDP, target, ensureChrome, sleep, log, BASE } from "./_e2elib";

let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) { pass++; log("  [GECTI] " + name + (detail ? " -> " + detail : "")); }
  else { fail++; log("  [KALDI **] " + name + (detail ? " -> " + detail : "")); }
}
const clickFirst = (re: string) => "(() => { const el=[...document.querySelectorAll('button,div,span,a')].filter(function(x){return new RegExp(" + JSON.stringify(re) + ").test(x.innerText||'');}).pop(); if(!el) return 'YOK'; el.click(); return 'TIKLANDI: '+(el.innerText||'').trim().slice(0,45); })()";

async function main() {
  ensureChrome();
  const t = await target();
  const c = await CDP.connect(t.webSocketDebuggerUrl);
  await c.send("Page.enable"); await c.send("Runtime.enable"); await c.send("Network.enable");

  log("\n##### MODUL 6: GARSON - ALAKART + MASA + SIPARIS GIRISI #####");
  await c.login("ahmet", "1234");
  let p = await c.eval("location.pathname");
  check("Garson girisi -> /waiter", p === "/waiter", "yol=" + p);

  let txt = await c.text();
  if (/Mutfağı \(KDS\)/.test(txt)) {
    log("      Alakart secim ekrani -> The Roof Garden seciliyor");
    await c.clickText("The Roof Garden");
    await sleep(6500);
    txt = await c.text();
  }
  check("Garson paneli yuklendi", txt.length > 100, "metin=" + txt.length + " karakter");

  const tabs = await c.tabTexts();
  log("      SEKMELER: " + tabs.slice(0, 260));
  check("'Sipariş Girişi' sekmesi var", tabs.indexOf("Sipariş Girişi") > -1);
  check("'Siparişlerim' sekmesi var", tabs.indexOf("Siparişlerim") > -1);
  await c.shot("t10-garson-paneli");

  const tableClicked = await c.eval(clickFirst("Panoramik Teras 2"));
  log("      " + tableClicked);
  check("Masa tiklandi -> siparis terminali", tableClicked.indexOf("TIKLANDI") === 0, tableClicked);
  await sleep(3000);

  txt = await c.text();
  check("Siparis terminali yuklendi (menu)", txt.length > 200, "metin=" + txt.length + " karakter");
  await c.shot("t11-garson-siparis-terminali");

  // Urun bul ve tikla (en uzun urun adi olan dugmeyi sec)
  const add = await c.eval("(() => { const btns=[...document.querySelectorAll('button')].filter(function(b){return /Ekle/.test(b.innerText||'') && b.offsetParent!==null;}); if(btns.length===0) return 'EKLE YOK'; btns[0].click(); return 'TIKLANDI: '+btns[0].innerText.trim().slice(0,40); })()");
  log("      " + add);
  check("Sepete urun eklendi", add.indexOf("TIKLANDI") === 0, add);
  await sleep(1800);

  const gonderBtn = await c.eval("(() => { const b=[...document.querySelectorAll('button')].filter(function(x){return /Mutfağa Gönder|Mutfağa İlet/.test(x.innerText||'') && x.offsetParent!==null;}).pop(); if(!b) return 'YOK'; b.click(); return 'TIKLANDI: '+b.innerText.trim().slice(0,45); })()");
  log("      " + gonderBtn);
  check("'Mutfağa Gönder' butonu tiklandi", gonderBtn.indexOf("TIKLANDI") === 0, gonderBtn);
  await sleep(3000);

  const onay = await c.eval("(() => { const b=[...document.querySelectorAll('button')].filter(function(x){return /^(Onayla|Gönder|Evet, Gönder)$/.test((x.innerText||'').trim()) && x.offsetParent!==null;}).pop(); if(!b) { const any2=[...document.querySelectorAll('button')].filter(function(x){return x.offsetParent!==null;}).map(function(x){return (x.innerText||'').trim().split('\\n')[0]}).join(' | '); return 'YOK | butonlar: '+any2.slice(0,300); } b.click(); return 'TIKLANDI: '+b.innerText.trim().slice(0,40); })()");
  log("      " + onay);
  check("Siparis onay modalinda gonderildi", onay.indexOf("TIKLANDI") === 0, onay);
  await sleep(7000);

  await c.shot("t12-garson-siparis-sonrasi");
  txt = await c.text();
  check("Siparis olusturuldu", !/Siparişi İncele & Mutfağa Gönder/.test(txt));

  log("\n##### OZET #####");
  log("  GECTI: " + pass + " | KALDI: " + fail);
  process.exit(fail > 0 ? 1 : 0);
}
main().catch(e => { console.error("HATA: " + e.message); process.exit(1); });