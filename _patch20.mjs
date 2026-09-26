import fs from "node:fs";
function load(p) { const raw = fs.readFileSync(p, "utf8"); const crlf = raw.indexOf("\r\n") > -1; return { lines: raw.split(crlf ? "\r\n" : "\n"), sep: crlf ? "\r\n" : "\n" }; }
function save(p, lines, sep) { fs.writeFileSync(p, lines.join(sep), "utf8"); }

const P = "D:/merit/alacarte/src/app/kitchen/page.tsx";
const o = load(P); let L = o.lines;
const bas = L.findIndex(l => l.trim() === "{!isCompleted ? (");
if (bas < 0) { console.error("bas bulunamadi"); process.exit(1); }
const son = L.findIndex((l, i) => i > bas && l.trim() === ")}" && l === "                        )}");
if (son < 0) { console.error("son bulunamadi"); process.exit(1); }
const yeni = [
  "                        {!isCompleted ? (",
  "                          canUpdateStatus ? (",
  "                            <button",
  "                              onClick={() => handleUpdateStatus(order.id, \"COMPLETED\")}",
  "                              className=\"flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-black transition-all active:scale-95 shadow-md shadow-emerald-500/20\"",
  "                            >",
  "                              <CheckCircle2 className=\"w-4 h-4\" />",
  "                              <span>Tamamlandı</span>",
  "                            </button>",
  "                          ) : null",
  "                        ) : (",
  "                          <div className=\"flex items-center gap-2\">",
  "                            <span className=\"flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold\">",
  "                              <Check className=\"w-3.5 h-3.5 text-emerald-400\" />",
  "                              <span>Tamamlandı</span>",
  "                            </span>",
  "                            {canUpdateStatus && (",
  "                              <button",
  "                                onClick={() => handleUpdateStatus(order.id, \"PREPARING\")}",
  "                                className=\"px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium border border-zinc-700 transition\"",
  "                                title=\"Gerekirse tekrar hazırlanıyor durumuna al\"",
  "                              >",
  "                                Geri Al (Ocak)",
  "                              </button>",
  "                            )}",
  "                          </div>",
  "                        )}",
];
L = L.slice(0, bas).concat(yeni, L.slice(son + 1));
save(P, L, o.sep);
console.log("[OK] Tamamlandi / Geri Al blogu duzeltildi (" + (bas + 1) + "-" + (son + 1) + ")");