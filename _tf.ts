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
  log("=== Garson: IPTAL SEBEBI + YAZICI FISI (DUZELTILMIS TEST) ===");

  await c.goto(BASE + "/login", 3000);
  await c.eval("localStorage.clear()");
  await c.login("ahmet", "1234");
  await c.blockPrint();
  await c.waitForText("ALAKART SE\u00c7\u0130M\u0130", 20000);
  await c.clickText("The Steak House");
  await c.waitForText("Sipari\u015f Giri\u015fi", 25000);

  await c.clickText("Sipari\u015flerim");
  await c.waitForText("Bug\u00fcn verdi\u011finiz", 20000);
  await sleep(1500);
  const orderNo = await c.eval("(function(){var m=(document.body.textContent||'').match(/#(\\d{1,6})/);return m?m[1]:''})()");
  log("   hedef siparis: #" + orderNo);
  ok("Siparis listede", orderNo.length > 0, orderNo);

  await c.clickText("#" + orderNo);
  ok("Detay + iptal butonu", await c.waitForText("\u0130ptal", 20000));

  await c.clickText("Sipari\u015fi \u0130ptal Et");
  ok("Iptal onay penceresi", await c.waitForText("Sipari\u015f \u0130ptal Onay\u0131", 15000));

  const sebepSel = "input[placeholder*='Müşteri vazgeçti'], input[placeholder*='hatalı'], textarea";
  const sebepVar = await c.eval("(function(){var e=document.querySelector(" + JSON.stringify(sebepSel) + ");return !!e})()");
  ok("Iptal sebebi alani mevcut", sebepVar);
  await c.setInput(sebepSel, "Misafir vazge\u00e7ti");
  const sebepVal = await c.eval("(function(){var e=document.querySelector(" + JSON.stringify(sebepSel) + ");return e?e.value:'(yok)'})()");
  ok("Sebep yazilabildi", sebepVal === "Misafir vazge\u00e7ti", sebepVal);
  await c.shot("t90-iptal-sebep-dolu");

  await c.clickText("\u0130ptali Onayla");
  ok("'Mutfağa Bilgi Gönderilsin mi?' cikti", await c.waitForText("Mutfa\u011fa Bilgi G\u00f6nderilsin mi?", 15000));

  await c.clickText("Evet, Mutfa\u011fa G\u00f6nder");
  ok("Iptal onaylandi", await c.waitForText("Sipari\u015f \u0130ptal Edildi", 25000));

  // "Iptal Fisini Yazdir" butonuna bas -> fis olusur (800ms sonra silinir)
  await c.clickText("\u0130ptal Fi\u015fini Yazd\u0131r");
  await sleep(350);
  const fis = await c.eval("(function(){var e=document.getElementById('garson-iptal-fisi');if(!e)return '(yok)';return e.innerText.replace(/\\s+/g,' ').slice(0,400)})()");
  log("   FIS: " + fis);
  ok("Yazici fisi olustu", fis !== "(yok)" && fis.length > 10, fis.slice(0, 100));
  ok("Fiste 'GÖNDERİLDİ' yaziyor", fis.indexOf("G\u00d6NDER\u0130LD\u0130") > -1, fis.slice(0, 200));
  ok("Fiste iptal sebebi yaziyor", fis.indexOf("Misafir vazge\u00e7ti") > -1, fis.slice(0, 220));
  ok("Fiste siparis no yaziyor", fis.indexOf("#" + orderNo) > -1, fis.slice(0, 220));
  ok("Fiste 'İptal Sebebi' etiketi", fis.indexOf("\u0130ptal Sebebi") > -1, fis.slice(0, 220));
  ok("Fiste 'İptal Edilen Ürünler'", fis.indexOf("\u0130ptal Edilen \u00dcr\u00fcnler") > -1, fis.slice(0, 300));
  const printCalled = await c.eval("!!window.__printCalled");
  ok("window.print() cagrildi (yazici cikti akisi)", printCalled);
  await c.shot("t91-iptal-fisi-dolu");

  await sleep(1500);
  const fisSilindi = await c.eval("(function(){return !document.getElementById('garson-iptal-fisi')})()");
  ok("Yazdirmadan sonra fis DOM'dan temizlendi", fisSilindi);

  await c.clickText("Kapat");
  await sleep(2000);

  const liste = await c.eval("(function(){var t=document.body.textContent||'';var i=t.indexOf('#"+orderNo+"');return t.slice(i,i+140)})()");
  log("   liste: " + liste.replace(/\s+/g, " "));
  ok("Listede '\u0130ptal Edildi'", liste.indexOf("\u0130ptal Edildi") > -1, liste.slice(0, 120));

  log("");
  log("=== SONUC: " + pass + " gecti, " + fail + " kaldi ===");
  process.exit(fail > 0 ? 1 : 0);
}
main();
