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
  log("=== GARSON: ALAKART -> MASA -> SERVIS NOTU -> SIPARIS -> IPTAL (E2E) ===");

  await c.goto(BASE + "/login", 3000);
  await c.eval("localStorage.clear()");
  const path = await c.login("ahmet", "1234");
  ok("Garson /waiter", path === "/waiter", path);
  await sleep(2500);
  await c.blockPrint();

  log("");
  log("[1] Alakart secimi");
  let body = await c.text();
  ok("ALAKART SECIMI ekrani", body.indexOf("ALAKART SE\u00c7\u0130M\u0130") > -1);
  const kart = await c.eval("[...document.querySelectorAll('button')].filter(b=>(b.innerText||'').indexOf('Kilitle')>-1).length");
  ok("5 alakart karti", kart === 5, String(kart));
  await c.clickText("The Steak House");
  await sleep(4500);
  body = await c.text();
  ok("Navbar alakart gostergesi guncellendi", body.indexOf("The Steak House") > -1);
  ok("Masa listesi (Diamond Prime VIP)", body.indexOf("Diamond Prime VIP") > -1);
  await c.shot("t46-masa-listesi");

  log("");
  log("[2] Masa secimi");
  await c.clickText("Diamond Prime VIP");
  await sleep(5500);
  body = await c.text();
  ok("Siparis Girdisi sekmesi", body.indexOf("Sipari\u015f Giri\u015fi") > -1);
  ok("Siparislerim sekmesi", body.indexOf("Sipari\u015flerim") > -1);

  log("");
  log("[3] Servis notlu urun: arama + hizli not secimi");
  const yaz = await c.eval("(() => { const i=document.querySelector(\"input[placeholder*='Yemek']\"); if(!i) return 'YOK'; const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(i),'value'); d.set.call(i,'Kemik'); i.dispatchEvent(new Event('input',{bubbles:true})); return 'OK'; })()");
  ok("Arama kutusuna 'Kemik' yazildi", yaz === "OK", yaz);
  await sleep(3500);
  const urunAdi = await c.eval("[...document.querySelectorAll('h3,h4')].map(e=>(e.textContent||'').trim()).filter(t=>t.indexOf('Kemik')>-1)[0]||''");
  log("   bulunan urun: " + urunAdi);
  ok("Servis notlu urun listelendi", urunAdi.length > 0, urunAdi);
  const secenekSatiri = await c.hasText("Se\u00e7enekler");
  ok("Kart uzerinde 'Se\u00e7enekler' satiri", secenekSatiri);
  await c.shot("t47-menu-servis-notu");

  await c.clickText("F\u0131r\u0131nlanm\u0131\u015f \u0130likli Dana Kemi\u011fi");
  await sleep(2200);
  const hizli = await c.eval("[...document.querySelectorAll('button')].map(b=>(b.textContent||'').trim()).filter(t=>t==='Ekstra K\u0131zarm\u0131\u015f Ekmek'||t==='Sa\u0131r\u0131msaks\u0131z Ekmek').join(' | ')");
  log("   hizli servis notu butonlari: " + hizli);
  ok("Modalda hizli servis notu butonlari", hizli.length > 0, hizli);
  await c.shot("t48-servis-notu-modal");

  if (hizli.length > 0) {
    await c.clickText("Ekstra K\u0131zarm\u0131\u015f Ekmek");
    await sleep(1200);
    await c.clickText("Sa\u0131r\u0131msaks\u0131z Ekmek");
    await sleep(1200);
    const notDegeri = await c.eval("[...document.querySelectorAll('textarea')].map(e=>e.value).filter(Boolean).join(' || ')");
    log("   siparis notu: " + notDegeri);
    ok("Iki hizli not secildi ve nota yazildi", notDegeri.indexOf("Ekstra K\u0131zarm\u0131\u015f") > -1 && notDegeri.indexOf("Sa\u0131r\u0131msaks\u0131z") > -1, notDegeri);

    await c.clickText("Sipari\u015fe Ekle");
    await sleep(2000);
    const sepette = await c.eval("(document.body.textContent||'').indexOf('Kemi\u011fi')>-1");
    ok("Urun sepete eklendi", sepette);
    const sepetNotu = await c.eval("(document.body.textContent||'').indexOf('Ekstra K\u0131zarm\u0131\u015f Ekmek')>-1");
    ok("Sepette servis notu gorunuyor", sepetNotu);
    await c.shot("t49-sepet-servis-notlu");
  }

  log("");
  log("[4] Siparis mutfaga gonderiliyor");
  await c.clickText("Sipari\u015fi \u0130ncele & Mutfa\u011fa G\u00f6nder");
  await sleep(2500);
  const onayVar = await c.has("Mutfak Sipari\u015fi Onay\u0131");
  ok("Siparis onay modali acildi", onayVar);
  await c.shot("t50-siparis-onay");

  await c.clickText("MUTFA\u011eA G\u00d6NDER", false);
  await sleep(4500);
  body = await c.text();
  const basari = body.indexOf("ba\u015far\u0131yla") > -1 || body.indexOf("mutfa\u011fa iletildi") > -1;
  ok("Siparis gonderildi (basari mesaji)", basari, body.slice(0, 140).replace(/\n/g, " | "));
  await c.shot("t51-siparis-gonderildi");

  log("");
  log("[5] Siparislerim sekmesi");
  await sleep(2500);
  await c.clickText("Sipari\u015flerim");
  await sleep(4000);
  body = await c.text();
  ok("Siparislerim sekmesi acildi", body.indexOf("Sipari\u015flerim") > -1);
  const orderNo = await c.eval("(function(){var m=(document.body.textContent||'').match(/#(\\d+)/); return m?m[1]:''})()");
  log("   siparis no: " + orderNo);
  const mutfakDurumu = await c.eval("[...document.querySelectorAll('*')].filter(e=>e.children.length===0&&(e.innerText||'').trim().length>0).map(e=>e.innerText.trim()).filter(t=>/Ocak Bekliyor|Haz\u0131rlan\u0131yor|Tamamland\u0131|Revizyon/.test(t)).join(' | ')");
  log("   mutfak durumu etiketleri: " + mutfakDurumu);
  ok("Mutfak durumu yanlarinda gorunuyor", mutfakDurumu.length > 0, mutfakDurumu);
  const notGorunur = await c.hasText("Ekstra K\u0131zarm\u0131\u015f");
  ok("Siparis icindeki servis notu gorunuyor", notGorunur);
  await c.shot("t52-siparislerim");

  log("");
  log("=== SONUC: " + pass + " gecti, " + fail + " kaldi ===");
  process.exit(fail > 0 ? 1 : 0);
}
main();