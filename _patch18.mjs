import fs from "node:fs";
function load(p) { const raw = fs.readFileSync(p, "utf8"); const crlf = raw.indexOf("\r\n") > -1; return { lines: raw.split(crlf ? "\r\n" : "\n"), sep: crlf ? "\r\n" : "\n" }; }
function save(p, lines, sep) { fs.writeFileSync(p, lines.join(sep), "utf8"); }

// 1) Sef panel basligi: "Chef Paneli" -> "SEF PANELI"
const CP = "D:/merit/alacarte/src/app/chef/page.tsx";
const co = load(CP); let cl = co.lines;
let n = 0;
cl = cl.map(l => { if (l.trim() === "Chef Paneli") { n++; return "              ŞEF PANELİ"; } return l; });
if (n !== 1) { console.error("Chef Paneli basligi " + n + " adet bulundu (1 olmali)"); process.exit(1); }
save(CP, cl, co.sep);
console.log("[OK] chef/page.tsx basligi -> ŞEF PANELİ");

// 2) Navbar: "CHIEF" sekmesi -> "ŞEF"
const NP = "D:/merit/alacarte/src/components/Navbar.tsx";
const no = load(NP); let nl = no.lines;
let m = 0;
nl = nl.map(l => { if (l.trim() === "label: \"CHIEF\",") { m++; return "      label: \"ŞEF\","; } return l; });
if (m !== 1) { console.error("Navbar CHEFF etiketi " + m + " adet"); process.exit(1); }
save(NP, nl, no.sep);
console.log("[OK] Navbar CHIEF -> ŞEF");