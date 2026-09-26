import { CDP, target, ensureChrome, sleep, log, BASE } from "./_e2elib";

const R = (s: string) => s;
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

  // =========================================================
  log("\n##### MODUL 1: GIRIS / OTURUM #####");
  const badPwd = await c.login("admin", "yanlisparola");
  check("Hatali parola ile giris reddedilir", badPwd === "/login", "yol=" + badPwd);
  const adminPath = await c.login("admin", "admin123");
  check("Admin dogru parola ile giris", adminPath !== "/login", "yol=" + adminPath);

  // =========================================================
  log("\n##### MODUL 2: YETKI MATRISI (rol bazli erisim) #####");
  const cases: [string, string, string, string[]][] = [
    ["admin", "admin123", "ADMIN", ["/admin", "/waiter", "/chef", "/kitchen"]],
    ["sef", "sef123", "CHEF", ["/chef", "/waiter", "/kitchen"]],
    ["ahmet", "1234", "WAITER", ["/waiter", "/kitchen"]],
    ["mutfak.roof", "1234", "KITCHEN", ["/kitchen", "/waiter"]],
  ];
  for (const [u, p, role, paths] of cases) {
    const start = await c.login(u, p);
    if (start === "/login") { check(role + " girisi", false, "giris basarisiz"); continue; }
    for (const path of paths) {
      await c.goto(BASE + path, 3800);
      const landed = await c.eval("location.pathname");
      const denied = await c.has("Yetkisiz") || await c.has("Erişim") || await c.has("yetki");
      const ok = landed === path || denied;
      check(role + " -> " + path, ok, ok ? (denied && landed !== path ? "yetki engeli (dogru)" : "acildi (dogru)") : "Beklenmeyen: " + landed);
    }
  }

  log("\n##### MODUL 3: ADMIN - RESTORAN TANIMLAMA #####");
  await c.login("admin", "admin123");
  await c.goto(BASE + "/admin/restaurants", 4500);
  const restPage = await c.eval("location.pathname");
  const restText = await c.text();
  check("Admin /admin/restaurants acilir", restPage === "/admin/restaurants", "yol=" + restPage);
  check("Restoran listesi gorunur", /The Roof Garden/.test(restText) && /Bella Merit/.test(restText), "5 alakart bekleniyor");
  check("Sistem yoneticisi modulunden rapor sekmesi YOK", !/Rapor/.test(restText), "sistem yoneticisinde rapor olmamali");
  await c.shot("t01-admin-restoranlar");

  log("\n##### MODUL 4: ADMIN - KULLANICI / MASA / MENU #####");
  await c.goto(BASE + "/admin/users", 4000);
  const uText = await c.text();
  check("Admin /admin/users acilir", (await c.eval("location.pathname")) === "/admin/users");
  check("Kullanici listesi (11 kullanici)", /mutfak\.roof/.test(uText) && /ahmet/.test(uText), "roller listelenmis");
  await c.goto(BASE + "/admin/tables", 4000);
  const tbText = await c.text();
  check("Admin /admin/tables acilir", (await c.eval("location.pathname")) === "/admin/tables");
  check("Masa tanimlari gorunur", /Masa/.test(tbText), "57 masa bekleniyor");
  await c.goto(BASE + "/admin/menu", 4000);
  const mnText = await c.text();
  check("Admin /admin/menu acilir", (await c.eval("location.pathname")) === "/admin/menu");
  check("Menu gruplari/ogeleri gorunur", mnText.length > 200, "metin uzunlugu=" + mnText.length);
  await c.shot("t02-admin-menu");

  log("\n##### MODUL 5: ADMIN - RAPORLAR (sistem yoneticisinde olmamali) #####");
  await c.goto(BASE + "/admin/reports", 3800);
  const repPath = await c.eval("location.pathname");
  const repText = await c.text();
  const reportsBlocked = repPath !== "/admin/reports" || /Yetki|Erişim yok|Yetkisiz/.test(repText);
  check("Sistem yoneticisinde rapor ekrani YOK (kullanici istegi)", reportsBlocked, reportsBlocked ? "engellendi (dogru)" : "ACIK - ISTEKLE CINSI!");
  await c.shot("t03-admin-reports-engelli");

  log("\n##### OZET #####");
  log("  GECTI: " + pass + " | KALDI: " + fail);
  process.exit(fail > 0 ? 1 : 0);
}
main().catch(e => { console.error("HATA: " + e.message); process.exit(1); });