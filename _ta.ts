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
  log("=== GARSON UCTAN UCA: ALAKART -> MASA -> SERVIS NOTU -> SIPARIS ===");

  await c.goto(BASE + "/login", 3000);
  await c.eval("localStorage.clear()");
  const path = await c.login("ahmet", "1234");
  ok("Garson /waiter sayfasinda", path === "/waiter", path);
  await c.blockPrint();

  log("");
  log("[1] Alakart secim ekrani");
  ok("ALAKART SECIMI ekrani", await c.waitForText("ALAKART SE\u00c7\u0130M\u0130"));
  const kart = await c.eval("[...document.querySelectorAll('button')].filter(b=>(b.textContent||'').indexOf('Kilitle')>-1).length");
  ok("5 alakart karti listelendi", kart === 5, String(kart));
  const kodlar = await c.eval("[...document.querySelectorAll('button')].filter(b=>(b.textContent||'').indexOf('Kilitle')>-1).map(b=>{const m=(b.textContent||'').match(/[A-Z_]{4,}/);return m?m[0]:'?'}).join(',')");
  ok("Tum alakart kodlari listede", ["ROOF_GARDEN","STEAK_HOUSE","BLUE_SEA","MANDARIN","BELLA_MERIT"].every(k => kodlar.indexOf(k) > -1), kodlar);
  await c.shot("t60-garson-alakart-secimi");

  log("");
  log("[2] The Steak House seciliyor");
  await c.clickText("The Steak House");
  ok("Masa listesi acildi", await c.waitForText("Diamond Prime VIP"));
  ok("Navbar alakart gostergesi guncellendi", await c.waitForText("Se\u00e7ilen Alakart", 8000));
  const nb = await c.eval("(document.body.textContent||'').indexOf('The Steak House')>-1");
  ok("Navbar'da alakart adi gorunuyor", nb);
  await c.shot("t61-masa-listesi");

  log("");
  log("[3] Masa seciliyor (Diamond Prime VIP)");
  await c.clickText("Diamond Prime VIP");
  const menuGeldi = await c.waitFor("document.querySelector(\"input[placeholder*='Yemek']\")!==null");
  ok("Siparis menu ekrani acildi", menuGeldi);
  await c.shot("t62-menu");

  log("");
  log("[4] Arama: 'Kemik'");
  await c.waitFor("document.querySelector(\"input[placeholder*='Yemek']\")!==null", 25000);
  const yaz = await c.eval("(()=>{const i=document.querySelector(\"input[placeholder*='Yemek']\");if(!i)return 'YOK';const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(i),'value');d.set.call(i,'Kemik');i.dispatchEvent(new Event('input',{bubbles:true}));return 'OK'})()");
  ok("Arama kutusuna yazildi", yaz === "OK", yaz);
  const urunGeldi = await c.waitForText("F\u0131r\u0131nlanm\u0131\u015f \u0130likli Dana Kemi\u011fi");
  ok("Servis notlu urun listelendi", urunGeldi);
  ok("Kartta 'Se\u00e7enekler' satiri var", await c.hasText("Se\u00e7enekler"));
  ok("Kartta hizli notlar ozetleniyor", await c.hasText("Ekstra K\u0131zarm\u0131\u015f Ekmek"));
  await c.shot("t63-arama-sonuc");

  log("");
  log("[5] Urun modal: hizli servis notu secimi");
  await c.clickText("F\u0131r\u0131nlanm\u0131\u015f \u0130likli Dana Kemi\u011fi");
  const modalAcik = await c.waitForText("Sipari\u015fe Ekle");
  ok("Urun adet/not modali acildi", modalAcik);
  const hizli1 = await c.waitForText("Ekstra K\u0131zarm\u0131\u015f Ekmek", 8000);
  ok("Hizli servis notu butonlari gorunuyor", hizli1);
  await c.shot("t64-servis-notu-modal");

  if (hizli1) {
    await c.clickText("Ekstra K\u0131zarm\u0131\u015f Ekmek");
    await sleep(900);
    await c.clickText("Sar\u0131msaks\u0131z Ekmek");
    await sleep(900);
    const notDegeri = await c.eval("[...document.querySelectorAll('textarea')].map(e=>e.value).filter(Boolean).join(' || ')");
    log("   siparis notu: " + notDegeri);
    ok("Iki hizli not secildi", notDegeri.indexOf("Ekstra K\u0131zarm\u0131\u015f") > -1 && notDegeri.indexOf("Sar\u0131msaks\u0131z") > -1, notDegeri);

    await c.clickText("Sipari\u015fe Ekle");
    const sepette = await c.waitForText("Ekstra K\u0131zarm\u0131\u015f Ekmek", 8000);
    ok("Urun sepete eklendi ve notuyla gorunuyor", sepette);
    await c.shot("t65-sepet-servis-notlu");
  }

  log("");
  log("[6] Siparis mutfaga gonderiliyor");
  await c.clickText("Sipari\u015fi \u0130ncele & Mutfa\u011fa G\u00f6nder");
  const onay = await c.waitForText("MUTFA\u011eA G\u00d6NDER");
  ok("Siparis onay modali acildi", onay);
  await c.shot("t66-siparis-onay");

  await c.clickText("MUTFA\u011eA G\u00d6NDER");
  const basari = await c.waitForText("mutfa\u011fa iletildi", 25000);
  ok("Siparis mutfaga iletildi", basari);
  await c.shot("t67-siparis-gonderildi");

  log("");
  log("[7] Siparislerim sekmesi");
  await sleep(2500);
  await c.clickText("Sipari\u015flerim");
  const liste = await c.waitForText("Bug\u00fcn verdi\u011finiz", 15000);
  ok("Siparislerim listesi acildi", liste);
  const bitti = await c.waitFor("(document.body.textContent||'').indexOf('Sipari\u015fleriniz y\u00fckleniyor')===-1", 25000);
  ok("Siparis listesi yuklendi", bitti);
  await sleep(1500);
  const panelMetin = await c.eval("(document.body.textContent||'').slice(0,2200)");
  log("   PANEL METNI: " + panelMetin);
  const orderNo = await c.eval("(function(){var m=(document.body.textContent||'').match(/#(\\d{1,6})/);return m?m[1]:''})()");
  log("   siparis no: #" + orderNo);
  ok("Siparis numarasi gorunuyor", orderNo.length > 0, orderNo);
  const durum = await c.eval("[...document.querySelectorAll('span,div')].map(e=>(e.textContent||'').trim()).filter(t=>t.length<40&&/Bekliyor|Haz\u0131rlan\u0131yor|Tamamland\u0131|Revizyon/.test(t)).filter((v,i,a)=>a.indexOf(v)===i).slice(0,4).join(' | ')");
  log("   mutfak durumu: " + durum);
  ok("Mutfak durumu siparisin yaninda", durum.length > 0, durum);
  ok("Siparis icinde servis notu var", await c.hasText("Ekstra K\u0131zarm\u0131\u015f Ekmek"));
  const iptalBtn = await c.eval("[...document.querySelectorAll('button')].filter(b=>(b.textContent||'').indexOf('Sipari\u015fi \u0130ptal Et')>-1).length");
  ok("Iptal butonu var", iptalBtn > 0, String(iptalBtn));
  await c.shot("t68-siparislerim");

  log("");
  log("=== SONUC: " + pass + " gecti, " + fail + " kaldi ===");
  process.exit(fail > 0 ? 1 : 0);
}
main();