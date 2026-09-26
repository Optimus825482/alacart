import { ensureChrome, target, CDP, BASE, sleep, log } from "./_e2elib";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; log("   [GECTI] " + name); }
  else { fail++; log("   [KALDI] " + name + (extra ? " -> " + extra : "")); }
}

async function main() {
  ensureChrome();
  const p = await target();
  const c = await CDP.connect(p.webSocketDebuggerUrl);
  await c.send("Page.enable");
  await c.send("Runtime.enable");

  log("");
  log("=== GARSON ALAKART SECIM EKRANI + SERVIS NOTU (E2E) ===");

  await c.goto(BASE + "/login", 3000);
  await c.eval("localStorage.clear()");

  log("");
  log("[1] Garson girisi (ahmet) -> alakart secim ekrani");
  const path = await c.login("ahmet", "1234");
  log("   yonlendirme: " + path);
  ok("Garson /waiter sayfasina yonlendi", path === "/waiter", path);
  await sleep(3000);

  let body = await c.text();
  ok("ALAKART SECIMI basligi gorunuyor", body.indexOf("ALAKART SE\u00c7\u0130M\u0130") > -1);
  ok("Kullanici soruluyor", body.indexOf("Hangi Alakartta G\u00f6revlisiniz") > -1);
  ok("'Alakart Atanmamis' uyarisi YOK", body.indexOf("Alakart Atanmam\u0131\u015f") === -1);

  const kart = await c.eval("[...document.querySelectorAll('button')].filter(b=>(b.innerText||'').indexOf('Kilitle')>-1).length");
  log("   alakart karti sayisi: " + kart);
  ok("5 alakart karti listelendi", kart === 5, String(kart));
  const kodlar = await c.eval("[...document.querySelectorAll('button')].filter(b=>(b.innerText||'').indexOf('Kilitle')>-1).map(b=>{const m=(b.innerText||'').match(/[A-Z_]{4,}/); return m?m[0]:'?'}).join(',')");
  log("   kodlar: " + kodlar);
  const beklenen = ["ROOF_GARDEN", "STEAK_HOUSE", "BLUE_SEA", "MANDARIN", "BELLA_MERIT"];
  ok("Tum 5 alakart kodu listede", beklenen.every(k => kodlar.indexOf(k) > -1), kodlar);
  await c.shot("t40-garson-alakart-secimi");

  log("");
  log("[2] 'The Steak House' alakarti seciliyor");
  await c.clickText("The Steak House");
  await sleep(4500);
  body = await c.text();
  ok("'The Steak House' basligi gorunuyor", body.indexOf("The Steak House") > -1);
  ok("Masa listesi ekrani (Diamond Prime VIP)", body.indexOf("Diamond Prime VIP") > -1);
  ok("Alakart secim ekrani kapandi", body.indexOf("Hangi Alakartta G\u00f6revlisiniz") === -1);
  await c.shot("t41-garson-masa-listesi-steakhouse");

  log("");
  log("[3] Masa seciliyor -> siparis girisi ekrani");
  await c.clickText("Diamond Prime VIP");
  await sleep(4000);
  body = await c.text();
  ok("Siparis Girdisi sekmesi", body.indexOf("Sipari\u015f Giri\u015fi") > -1);
  ok("Siparislerim sekmesi", body.indexOf("Sipari\u015flerim") > -1);
  ok("Masa secildi (Diamond Prime VIP)", body.indexOf("Diamond Prime VIP") > -1);
  await c.shot("t42-garson-menu-steakhouse");

  log("");
  log("[4] Servis notlu urun: 'Firinlanmis Ilikli Dana Kemiği'");
  const arama = await c.eval("(()=>{const i=document.querySelector(\"input[placeholder*='Yemek']\"); if(!i) return 'YOK'; const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(i),'value'); d.set.call(i,'Kemik'); i.dispatchEvent(new Event('input',{bubbles:true})); return 'OK';})()");
  log("   arama kutusu: " + arama);
  await sleep(2500);
  const bulundu = await c.has("Kemik");
  ok("Arama ile urun listelendi", bulundu);
  if (bulundu) {
    await c.clickText("Kemik");
    await sleep(2000);
    body = await c.text();
    ok("Modal acildi (urun adet/not)", body.indexOf("Sipari\u015fe Ekle") > -1 || body.indexOf("G\u00fcncelle") > -1);
    const hizliNot = await c.eval("[...document.querySelectorAll('button')].map(b=>(b.innerText||'').trim()).filter(t=>t.indexOf('Ekstra K\u0131zarm\u0131\u015f Ekmek')>-1||t.indexOf('Sa\u0131r\u0131msaks\u0131z Ekmek')>-1).join(' | ')");
    log("   hizli not butonlari: " + hizliNot);
    ok("Modalda hizli servis notu butonlari var", hizliNot.length > 0, hizliNot);
    await c.shot("t43-servis-notu-modal");

    if (hizliNot.length > 0) {
      await c.clickText("Ekstra K\u0131zarm\u0131\u015f Ekmek");
      await sleep(1500);
      const notMetni = await c.eval("[...document.querySelectorAll('textarea,input')].map(e=>e.value).filter(v=>v&&v.indexOf('Ekstra K\u0131zarm\u0131\u015f')>-1).join('||')");
      log("   siparis notu alani: " + notMetni);
      ok("Secilen servis notu siparis notuna yazildi", notMetni.length > 0, notMetni);

      await c.clickText("Sipari\u015fe Ekle");
      await sleep(1800);
      const sepette = await c.has("Kemik");
      ok("Urun sepete eklendi", sepette);
      await c.shot("t44-sepet-servis-notlu");
    }
  }

  log("");
  log("=== SONUC: " + pass + " gecti, " + fail + " kaldi ===");
  process.exit(fail > 0 ? 1 : 0);
}
main();