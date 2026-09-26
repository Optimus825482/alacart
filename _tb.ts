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
  log("=== GARSON: SIPARISLERIM + IPTAL AKIISI (E2E) ===");

  await c.goto(BASE + "/login", 3000);
  await c.eval("localStorage.clear()");
  const path = await c.login("ahmet", "1234");
  ok("Garson girisi", path === "/waiter", path);
  await c.blockPrint();
  await c.waitForText("ALAKART SE\u00c7\u0130M\u0130", 20000);
  await c.clickText("The Steak House");
  ok("Alakart secildi", await c.waitForText("Sipari\u015f Giri\u015fi", 25000));

  log("");
  log("[1] Siparislerim sekmesi");
  await c.clickText("Sipari\u015flerim");
  ok("Panel basligi", await c.waitForText("Bug\u00fcn verdi\u011finiz", 20000));
  ok("Liste yuklendi", await c.waitFor("(document.body.textContent||'').indexOf('Sipari\u015fleriniz y\u00fckleniyor')===-1", 25000));
  await sleep(1500);
  const orderNo = await c.eval("(function(){var m=(document.body.textContent||'').match(/#(\\d{1,6})/);return m?m[1]:''})()");
  log("   siparis no: #" + orderNo);
  ok("Siparis listede (#" + orderNo + ")", orderNo.length > 0, orderNo);
  const durum = await c.eval("(function(){var t=document.body.textContent||'';var m=t.match(/#\\d{1,6}[^#]{0,120}/);return m?m[0].slice(0,120):''})()");
  log("   satir: " + durum.replace(/\\s+/g, " "));
  ok("Mutfak durumu satirda", /Bekliyor|Haz\u0131rlan\u0131yor|Tamamland\u0131/.test(durum), durum);
  await c.shot("t70-siparislerim-liste");

  log("");
  log("[2] Siparis detayi aciliyor (tiklaninca siparis acilmali)");
  await c.clickText("#" + orderNo);
  const detay = await c.waitForText("\u0130ptal", 20000);
  ok("Siparis detayi + iptal butonu gorundu", detay);
  const detayMetin = await c.eval("(function(){var t=document.body.textContent||'';var i=t.indexOf('#"+orderNo+"');return t.slice(i,i+420)})()");
  log("   detay: " + detayMetin.replace(/\\s+/g, " "));
  ok("Servis notu detayda gorunuyor", detayMetin.indexOf("Ekstra K\u0131zarm\u0131\u015f") > -1, detayMetin.slice(0, 120));
  await c.shot("t71-siparis-detay");

  log("");
  log("[3] Iptal onay penceresi");
  await c.clickText("Sipari\u015fi \u0130ptal Et");
  ok("Iptal onay penceresi acildi", await c.waitForText("Sipari\u015f \u0130ptal Onay\u0131", 15000));
  const sebepVar = await c.has("sebep");
  ok("Iptal sebebi alani var", sebepVar);
  await c.shot("t72-iptal-onay");

  const sebep = "Misafir vazge\u00e7ti";
  await c.setInput("input[placeholder*='sebep'], textarea[placeholder*='sebep'], input[placeholder*=' Sebep']", sebep);
  const yazildi = await c.eval("(function(){var i=document.querySelector(\"input[placeholder*='ebep'],textarea[placeholder*='ebep']\");return i?i.value:'(yok)'})()");
  log("   sebep alani: " + yazildi);
  await c.shot("t73-iptal-sebep");

  log("");
  log("[4] 'Iptali Onayla' -> 'Mutfaga Bilgi Gonderilsin mi?'");
  await c.clickText("\u0130ptali Onayla");
  const soru = await c.waitForText("Mutfa\u011fa Bilgi G\u00f6nderilsin mi?", 15000);
  ok("'Mutfaga Bilgi Gonderilsin mi?' sorusu cikti", soru);
  await c.shot("t74-mutfaga-bildirilsin-mi");

  log("");
  log("[5] 'Evet, Mutfaga Gonder'");
  await c.clickText("Evet, Mutfa\u011fa G\u00f6nder");
  const bitti = await c.waitForText("Sipari\u015f \u0130ptal Edildi", 25000);
  ok("Iptal onaylandi ve yazidan cikti ekrani acildi", bitti);
  const fisMetni = await c.eval("(function(){var e=document.getElementById('garson-iptal-fisi');return e?e.innerText.replace(/\\s+/g,' ').slice(0,300):'(fis yok)'})()");
  log("   fis: " + fisMetni);
  ok("Iptal fisinde 'GONDERILDI' yaziyor", fisMetni.indexOf("G\u00d6NDER\u0130LD\u0130") > -1, fisMetni.slice(0, 140));
  await c.shot("t75-iptal-fisi");

  await c.clickText("Kapat");
  await sleep(2500);
  const liste2 = await c.eval("(function(){var t=document.body.textContent||'';var i=t.indexOf('#"+orderNo+"');return t.slice(i,i+160)})()");
  log("   liste sonrasi: " + liste2.replace(/\\s+/g, " "));
  ok("Siparis listede 'Iptal Edildi' olarak", /Iptal Edildi/.test(liste2), liste2.slice(0, 120));
  await c.shot("t76-iptal-sonrasi-liste");

  log("");
  log("=== SONUC: " + pass + " gecti, " + fail + " kaldi ===");
  process.exit(fail > 0 ? 1 : 0);
}
main();