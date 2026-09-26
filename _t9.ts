import { ensureChrome, target, CDP, BASE, sleep, log } from "./_e2elib";

async function main() {
  ensureChrome();
  const p = await target();
  const c = await CDP.connect(p.webSocketDebuggerUrl);
  await c.send("Page.enable");
  await c.send("Runtime.enable");
  log("");
  log("=== TANI: menu icerigi ===");
  await c.goto(BASE + "/login", 3000);
  await c.eval("localStorage.clear()");
  await c.login("ahmet", "1234");
  await sleep(2000);
  await c.clickText("The Steak House");
  await sleep(4000);
  await c.clickText("Diamond Prime VIP");
  await sleep(4500);

  const h4all = await c.eval("[...document.querySelectorAll('h4')].map(e=>(e.textContent||'').trim()).join(' ~ ')");
  log("H4 (varsayilan kategori): " + h4all.slice(0, 400));
  const cats = await c.eval("[...document.querySelectorAll('button')].map(b=>(b.textContent||'').trim()).filter(t=>t.length>2&&t.length<40).join(' | ')");
  log("BUTONLAR: " + cats.slice(0, 600));

  log("");
  log("--- arama: Kemik ---");
  await c.eval("(()=>{const i=document.querySelector(\"input[placeholder*='Yemek']\");const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(i),'value');d.set.call(i,'Kemik');i.dispatchEvent(new Event('input',{bubbles:true}));return i.value})()");
  await sleep(3000);
  const val = await c.eval("document.querySelector(\"input[placeholder*='Yemek']\").value");
  log("input degeri: " + val);
  const h4b = await c.eval("[...document.querySelectorAll('h4')].map(e=>(e.textContent||'').trim()).join(' ~ ')");
  log("H4 (arama sonrasi): " + h4b.slice(0, 400));
  const all = await c.eval("(document.body.textContent||'').slice(0,2500)");
  log("TEXT (ilk 2500): " + all);
  await c.shot("t53-tani-menu");
  process.exit(0);
}
main();