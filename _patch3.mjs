import fs from "node:fs";
const P = "D:/merit/alacarte/_e2elib.ts";
let s = fs.readFileSync(P, "utf8");
if (s.includes("async setInput")) { console.log("zaten var"); process.exit(0); }
const anchor = "  async text(): Promise<string> { return this.eval(\"document.body.innerText\"); }";
const line = "  async setInput(sel: string, val: string) { return this.eval(\"(() => { const el=document.querySelector(\" + JSON.stringify(sel) + \"); if(!el) return 'YOK'; const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value'); d.set.call(el,\" + JSON.stringify(val) + \"); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); return 'OK'; })()\"); }";
if (!s.includes(anchor)) { console.error("anchor yok"); process.exit(1); }
s = s.replace(anchor, line + "\n" + anchor);
fs.writeFileSync(P, s, "utf8");
console.log("setInput eklendi");