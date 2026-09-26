import fs from "node:fs";

function load(p) {
  const raw = fs.readFileSync(p, "utf8");
  const crlf = raw.indexOf("\r\n") > -1;
  return { lines: raw.split(crlf ? "\r\n" : "\n"), sep: crlf ? "\r\n" : "\n" };
}
function save(p, lines, sep) { fs.writeFileSync(p, lines.join(sep), "utf8"); }

// 1) Navbar
const NP = "D:/merit/alacarte/src/components/Navbar.tsx";
let n = load(NP).lines;
let start = n.findIndex(l => l.trim().startsWith("useEffect(() => {"));
if (start < 0) { console.error("navbar useEffect yok"); process.exit(1); }
let end = -1;
for (let k = start + 1; k < n.length; k++) { if (n[k].trim() === "}, [pathname]);") { end = k; break; } }
if (end < 0) { console.error("navbar useEffect bitisi yok"); process.exit(1); }
const yeni = [
  "  useEffect(() => {",
  "    let iptal = false;",
  "    async function loadSession() {",
  "      if (iptal) return;",
  "      const user = await getSessionUser();",
  "      if (!iptal) setSession(user);",
  "    }",
  "    loadSession();",
  "    // Alakart secildiginde navbar gostergesini aninda yenile",
  "    const yenile = () => { loadSession(); };",
  "    window.addEventListener(\"alacarte:session\", yenile);",
  "    return () => {",
  "      iptal = true;",
  "      window.removeEventListener(\"alacarte:session\", yenile);",
  "    };",
  "  }, [pathname]);",
];
n = n.slice(0, start).concat(yeni, n.slice(end + 1));
save(NP, n, load(NP).sep);
console.log("[OK] Navbar session dinleyicisi");

// 2) waiter
const WP = "D:/merit/alacarte/src/app/waiter/page.tsx";
const wobj = load(WP);
let w = wobj.lines;
const anchor = w.findIndex(l => l.includes("await loadRestaurant(res.restaurant.id);"));
if (anchor < 0) { console.error("waiter anchor yok"); process.exit(1); }
w.splice(anchor + 1, 0,
  "        // Navbar'daki \"Seçilen Alakart\" göstergesini anında güncelle",
  "        try { window.dispatchEvent(new Event(\"alacarte:session\")); } catch {}"
);
save(WP, w, wobj.sep);
console.log("[OK] waiter handleSelectRestaurant event yayini");