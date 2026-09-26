import fs from "node:fs";
function load(p) { const raw = fs.readFileSync(p, "utf8"); const crlf = raw.indexOf("\r\n") > -1; return { lines: raw.split(crlf ? "\r\n" : "\n"), sep: crlf ? "\r\n" : "\n" }; }
function save(p, lines, sep) { fs.writeFileSync(p, lines.join(sep), "utf8"); }
const P = "D:/merit/alacarte/src/app/kitchen/page.tsx";
const o = load(P); let L = o.lines;
// 764-778 (1-indeks) artik blok: sil
const bas = 763;
if (L[bas].trim() !== ") : (") { console.error("beklenen bas: " + L[bas]); process.exit(1); }
const son = 777;
if (L[son].trim() !== ")}") { console.error("beklenen son: " + L[son]); process.exit(1); }
L = L.slice(0, bas).concat(L.slice(son + 1));
save(P, L, o.sep);
console.log("[OK] kopya blok silindi");