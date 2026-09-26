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
  await c.send("Page.enable"); await c.send("Runtime.enable"); await c.send("Network.enable");

  log("\n##### ALAKART OTOMATIK ATAMA (secim ekrani olmamali) #####");
  const users: [string, string, string, string][] = [
    ["ahmet", "1234", "/waiter", "The Roof Garden"],
    ["mehmet", "1234", "/waiter", "Blue Sea"],
    ["mutfak.roofgarden", "1234", "/kitchen", "The Roof Garden"],
    ["mutfak.steakhouse", "1234", "/kitchen", "The Steak House"],
    ["mutfak.bluesea", "1234", "/kitchen", "Blue Sea"],
    ["mutfak.mandarin", "1234", "/kitchen", "Mandarin"],
    ["mutfak.bellamerit", "1234", "/kitchen", "Bella Merit"],
  ];
  for (const [u, p, path, expect] of users) {
    const start = await c.login(u, p);
    if (start === "/login") { check(u + " girisi", false, "basarisiz"); continue; }
    await c.goto(BASE + path, 4200);
    const txt = await c.text();
    const landed = await c.eval("location.pathname");
    const selEkran = /Hangi Alakart|MUTFAK İSTASYONU SEÇİMİ|GÖREV YERİ SEÇİMİ/.test(txt);
    const dogruAlakart = txt.indexOf(expect) > -1;
    check(u + " (" + expect + ") secim ekrani yok", !selEkran && landed === path, selEkran ? "SECIM EKRANI CIKTI **" : (dogruAlakart ? "otomatik atandi, dogru alakart" : "panel yuklendi"));
  }
  await c.shot("t20-mutfak-otomatik-atama");

  log("\n##### ESKI HESAPLAR DEVRE DISI #####");
  for (const u of ["mutfak.roof", "mutfak.steak", "mutfak.bella"]) {
    const p = await c.login(u, "1234");
    check(u + " pasif (giris reddedilmeli)", p === "/login", p === "/login" ? "reddedildi (dogru)" : "GIRIS YAPTIL **");
  }

  log("\n##### OZET #####");
  log("  GECTI: " + pass + " | KALDI: " + fail);
  process.exit(fail > 0 ? 1 : 0);
}
main().catch(e => { console.error("HATA: " + e.message); process.exit(1); });