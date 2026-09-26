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

  log("\n##### MODUL 2b: YETKI KORUMASI (yeni layout'lar) #####");
  const deny: [string, string, string, string][] = [
    ["mutfak.roof", "1234", "/waiter", "KITCHEN garson modulune giremez"],
    ["ahmet", "1234", "/admin", "WAITER sistem yoneticisine giremez"],
    ["ahmet", "1234", "/chef", "WAITER sef paneline giremez"],
    ["sef", "sef123", "/admin/users", "CHEF tanim ekranina giremez"],
    ["mutfak.roof", "1234", "/admin/menu", "KITCHEN menu tanimina giremez"],
  ];
  for (const [u, p, path, desc] of deny) {
    await c.login(u, p);
    await c.goto(BASE + path, 4000);
    const landed = await c.eval("location.pathname");
    const blocked = landed !== path;
    check(desc, blocked, blocked ? "yonlendirildi: " + landed : "ACIK KALDI: " + landed);
  }
  const allow: [string, string, string][] = [
    ["ahmet", "1234", "/waiter"], ["mutfak.roof", "1234", "/kitchen"], ["sef", "sef123", "/chef"], ["admin", "admin123", "/admin/users"],
  ];
  for (const [u, p, path] of allow) {
    await c.login(u, p);
    await c.goto(BASE + path, 4000);
    const landed = await c.eval("location.pathname");
    check((u + " -> " + path + " erisimi"), landed === path, "yol=" + landed);
  }

  log("\n##### OZET #####");
  log("  GECTI: " + pass + " | KALDI: " + fail);
  process.exit(fail > 0 ? 1 : 0);
}
main().catch(e => { console.error("HATA: " + e.message); process.exit(1); });