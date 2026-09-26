import { CDP, target, ensureChrome, sleep, log, BASE } from "./_e2elib";
async function main() {
  ensureChrome();
  const t = await target();
  const c = await CDP.connect(t.webSocketDebuggerUrl);
  await c.send("Page.enable"); await c.send("Runtime.enable");
  await c.login("ahmet", "1234");
  await sleep(3000);
  const dump = await c.eval("JSON.stringify({path:location.pathname, bodyLen:document.body.innerText.length, text:document.body.innerText.slice(0,1500), btns:[...document.querySelectorAll('button')].map(b=>(b.innerText||'').trim().slice(0,30)).slice(0,25)})");
  console.log(dump);
  process.exit(0);
}
main().catch(e => { console.error("HATA: " + e.message); process.exit(1); });