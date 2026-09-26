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
  log("=== SEF PANELI (CHEF) E2E ===");
  await c.goto(BASE + "/login", 3000);
  await c.eval("localStorage.clear()");
  const path = await c.login("sef", "sef123");
  ok("Sef /chef sayfasinda", path === "/chef", path);
  await sleep(4000);
  await c.blockPrint();

  log("");
  log("[1] Panel basligi ve moduller");
  const body = await c.text();
  ok("SEF PANELI basligi", body.indexOf("SEF PANEL\u0130") > -1 || body.indexOf("\u015eEF PANEL\u0130") > -1, body.slice(0, 200).replace(/\n/g, " | "));
  ok("'CHEF' panel basligi olarak kullanilmiyor", body.indexOf("CHEF PANEL") === -1);
  const sekmeler = await c.eval("[...document.querySelectorAll('button,a')].map(b=>(b.textContent||'').trim()).filter(t=>t.length>2&&t.length<40).join(' | ')");
  log("   sekmeler/linkler: " + sekmeler);
  ok("Rapor modulu var", /Rapor/.test(sekmeler) || /Rapor/.test(await c.eval("(document.body.textContent||'')")), sekmeler);
  ok("Canli siparis/modul gorunuyor", /Canl\u0131|Sipari\u015f|Operasyon|\u0130\u015flem/.test(sekmeler), sekmeler);
  await c.shot("t90-sef-paneli");

  log("");
  log("[2] Rapor ekrani: PDF / Excel ciktilari");
  await c.clickText("Rapor");
  await sleep(3500);
  const body2 = await c.text();
  ok("Rapor ekrani acildi", body2.length > 50, body2.slice(0, 150).replace(/\n/g, " | "));
  const raporMetni = await c.eval("(document.body.textContent||'').slice(0,1200)");
  log("   rapor metni: " + raporMetni.replace(/\\s+/g, " ").slice(0, 500));
  ok("PDF cikti secenegi var", /PDF/.test(raporMetni), "");
  ok("Excel cikti secenegi var", /Excel|EXCEL|XLSX/.test(raporMetni), "");
  ok("Tarih araligi secimi var", /Tarih|Aral\u0131k|From|Bug\u00fcn/.test(raporMetni), "");
  await c.shot("t91-sef-rapor");

  log("");
  log("[3] Sef siparis girebilir (WAITER modulu erisimi)");
  await c.goto(BASE + "/waiter", 6000);
  const w = await c.text();
  ok("Sef /waiter ekranina eristi", w.indexOf("Sipari\u015f Giri\u015fi") > -1 || w.indexOf("ALAKART SE\u00c7\u0130M\u0130") > -1, w.slice(0, 160).replace(/\n/g, " | "));
  if (w.indexOf("ALAKART SE\u00c7\u0130M\u0130") > -1) {
    const kart = await c.eval("[...document.querySelectorAll('button')].filter(b=>(b.textContent||'').indexOf('Kilitle')>-1).length");
    ok("Sef 5 alakart secimi yapabiliyor", kart === 5, String(kart));
  }
  await c.shot("t92-sef-waiter");

  log("");
  log("[4] Sef mutfakta gormeli ama HAZIRLANDI/TAMAMLANDI guncelleyememeli");
  await c.goto(BASE + "/kitchen", 6000);
  const k = await c.text();
  ok("Sef /kitchen ekranina eristi", k.length > 40, k.slice(0, 160).replace(/\n/g, " | "));
  const durumBtn = await c.eval("[...document.querySelectorAll('button')].map(b=>(b.textContent||'').trim()).filter(t=>/^(Haz\u0131rlan\u0131yor|Tamamland\u0131|Geri Al \(Ocak\))$/.test(t)).join(' | ')");
  log("   durum butonlari: '" + durumBtn + "'");
  ok("Sef HAZIRLANDI/TAMAMLANDI butonu GORMUYOR", durumBtn.length === 0, durumBtn);
  await c.shot("t93-sef-kitchen");

  log("");
  log("=== SONUC: " + pass + " gecti, " + fail + " kaldi ===");
  process.exit(fail > 0 ? 1 : 0);
}
main();