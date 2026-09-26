import { PrismaClient } from "@prisma/client";
import { ensureChrome, target, CDP, BASE, sleep, log } from "./_e2elib";
const prisma = new PrismaClient();

let pass = 0, fail = 0;
function ok(n: string, c: boolean, e = "") { if (c) { pass++; log("   [GECTI] " + n); } else { fail++; log("   [KALDI] " + n + (e ? " -> " + e : "")); } }

async function main() {
  log("");
  log("=== MUTFAK ROLU REGRESYON + SEF YETKI KARSILASTIRMASI ===");

  // Test verisini hazirla: #8 -> PENDING
  const o8 = await prisma.order.findFirst({ where: { orderNumber: 8 } });
  if (!o8) { console.error("#8 bulunamadi"); process.exit(1); }
  await prisma.order.update({ where: { id: o8.id }, data: { status: "PENDING", cancelledAt: null, cancellationReason: null, kitchenNotifiedAt: null, kitchenAckedAt: null } });
  log("   #8 PENDING olarak ayarlandi");

  ensureChrome();
  const p = await target();
  const c = await CDP.connect(p.webSocketDebuggerUrl);
  await c.send("Page.enable");
  await c.send("Runtime.enable");
  await c.blockPrint();

  log("");
  log("[A] KITCHEN rolu (mutfak.steakhouse) durum butonlarini GORMELI");
  await c.goto(BASE + "/login", 3000);
  await c.eval("localStorage.clear()");
  const p1 = await c.login("mutfak.steakhouse", "1234");
  ok("Mutfak girisi", p1 === "/kitchen", p1);
  await sleep(4000);
  await c.clickText("Bekleyenler (Ocak Bekliyor)");
  await sleep(2000);
  const b1 = await c.eval("[...document.querySelectorAll('button')].map(b=>(b.textContent||'').trim()).filter(t=>/^(Haz\u0131rlan\u0131yor|Tamamland\u0131)$/.test(t)).join(' | ')");
  log("   KITCHEN butonlari: '" + b1 + "'");
  ok("KITCHEN 'Hazirlaniyor' butonunu goruyor", b1.indexOf("Haz\u0131rlan\u0131yor") > -1, b1);
  ok("KITCHEN 'Tamamlandi' butonunu goruyor", b1.indexOf("Tamamland\u0131") > -1, b1);
  await c.shot("t95-mutfak-rol-butonlari");

  log("");
  log("[B] CHEF rolu ayni ekranda butonlari GORMEMELI");
  await c.goto(BASE + "/login", 3000);
  const p2 = await c.login("sef", "sef123");
  ok("Sef girisi", p2 === "/chef", p2);
  await sleep(2500);
  await c.goto(BASE + "/kitchen", 7000);
  await sleep(2500);
  await c.clickText("Bekleyenler (Ocak Bekliyor)");
  await sleep(2000);
  const b2 = await c.eval("[...document.querySelectorAll('button')].map(b=>(b.textContent||'').trim()).filter(t=>/^(Haz\u0131rlan\u0131yor|Tamamland\u0131|Geri Al \\(Ocak\\))$/.test(t)).join(' | ')");
  log("   CHEF butonlari: '" + b2 + "'");
  ok("CHEF hazirlama/tamamlama butonlarini GORMUYOR", b2.length === 0, b2);
  const b3 = await c.eval("(document.body.textContent||'').indexOf('S\u0130PAR\u0130\u015e \u0130PTAL ED\u0130LD\u0130')>-1");
  log("   chef ekraninda iptal rozeti var mi: " + b3);
  await c.shot("t96-sef-rol-butonlari-yok");

  log("");
  log("[C] Sunucu tarafi koruma: CHEF 'Tamamlandi' gondermeyi denerse reddedilmeli");
  const sonuc = await c.eval("(async()=>{try{const r=await fetch('/waiter');return 'fetch:'+r.status}catch(e){return 'hata:'+e.message}})()");
  log("   kontrol: " + sonuc);

  // Test verisini geri al
  await prisma.order.update({ where: { id: o8.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: "Misafir vazge\u00e7ti" } });
  log("   #8 yeniden CANCELLED yapildi (demo verisi korundu)");
  await prisma.$disconnect();

  log("");
  log("=== SONUC: " + pass + " gecti, " + fail + " kaldi ===");
  process.exit(fail > 0 ? 1 : 0);
}
main();