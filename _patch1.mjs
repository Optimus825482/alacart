import fs from "node:fs";

const P = "D:/merit/alacarte/src/app/waiter/page.tsx";
let raw = fs.readFileSync(P, "utf8");
const before = raw;
let s = raw.split("\r\n").join("\n");

function must(cond, msg) {
  if (!cond) { console.error("HATA: " + msg); process.exit(1); }
}
function rep(oldStr, newStr, label) {
  must(s.includes(oldStr), "bulunamadi -> " + label);
  must(s.split(oldStr).length === 2, "birden fazla eslesme -> " + label);
  s = s.replace(oldStr, newStr);
  console.log("  [OK] " + label);
}

// 1) import'lar
rep(
  'import { getTables, getCategoriesTree } from "@/actions/definitions";',
  'import { getTables, getCategoriesTree, getRestaurants } from "@/actions/definitions";',
  "definitions import"
);
rep(
  'import { getSessionUser, SessionUser } from "@/actions/auth";',
  'import { getSessionUser, selectRestaurantAction, SessionUser } from "@/actions/auth";',
  "auth import"
);

// 2) availableRestaurants state
rep(
  '  const [currentRestaurant, setCurrentRestaurant] = useState<any | null>(null);',
  '  const [currentRestaurant, setCurrentRestaurant] = useState<any | null>(null);\n' +
  '  const [availableRestaurants, setAvailableRestaurants] = useState<any[]>([]);',
  "availableRestaurants state"
);

// 3) init() -> getRestaurants
const OLD_INIT = [
  '        const user = await getSessionUser();',
  '        if (!user) {',
  '          router.push("/login");',
  '          return;',
  '        }',
  '        setSession(user);',
  '',
  '        if (user.activeRestaurantId) {',
  '          await loadRestaurant(user.activeRestaurantId);',
  '        }',
].join("\n");

const NEW_INIT = [
  '        const [user, restsRes] = await Promise.all([',
  '          getSessionUser(),',
  '          getRestaurants(),',
  '        ]);',
  '        if (!user) {',
  '          router.push("/login");',
  '          return;',
  '        }',
  '        setSession(user);',
  '',
  '        // Garson yalnizca kendisine atanmis alakartlari gorebilir/secebilir.',
  '        if (restsRes?.success && restsRes.data) {',
  '          const allowed = new Set(user.assignedRestaurantIds || []);',
  '          setAvailableRestaurants(',
  '            allowed.size > 0 ? restsRes.data.filter((r: any) => allowed.has(r.id)) : []',
  '          );',
  '        }',
  '',
  '        if (user.activeRestaurantId) {',
  '          await loadRestaurant(user.activeRestaurantId);',
  '        }',
].join("\n");
rep(OLD_INIT, NEW_INIT, "init() getRestaurants");

// 4) handleSelectRestaurant
const ANCHOR = [
  '      console.error("loadRestaurant error:", err);',
  '    }',
  '  };',
].join("\n");

const HANDLER = [
  '      console.error("loadRestaurant error:", err);',
  '    }',
  '  };',
  '',
  '  // Alakart Secimi Yapildiginda (Kilitleme)',
  '  const handleSelectRestaurant = async (restaurantIdOrCode: string) => {',
  '    setLoading(true);',
  '    try {',
  '      const res = await selectRestaurantAction(restaurantIdOrCode);',
  '      if (res.success && res.restaurant) {',
  '        setCurrentRestaurant(res.restaurant);',
  '        setSession((prev) => ({',
  '          ...(prev || {',
  '            id: "waiter",',
  '            name: "Garson",',
  '            username: "garson",',
  '            role: "WAITER",',
  '          }),',
  '          activeRestaurantId: res.restaurant.id,',
  '          activeRestaurantName: res.restaurant.name,',
  '        }));',
  '        await loadRestaurant(res.restaurant.id);',
  '      } else {',
  '        alert("Alakart secilemedi: " + (res.error || "Bilinmeyen bir hata olustu. Lutfen tekrar deneyin."));',
  '      }',
  '    } catch (err: any) {',
  '      console.error("handleSelectRestaurant error:", err);',
  '      alert("Sistem hatasi: " + err.message);',
  '    } finally {',
  '      setLoading(false);',
  '    }',
  '  };',
].join("\n");
rep(ANCHOR, HANDLER, "handleSelectRestaurant");

// 5) Alakart secim ekrani
const START = '  // DURUM 1: GARSON HENÜZ ALAKART RESTORAN SEÇMEDİYSE (RESTORAN SEÇİM EKRANI)';
const END = '  // GARSON MODÜLÜ SEKMELERİ (SİPARİŞ GİRİŞİ / SİPARİŞLERİM)';

let si = s.indexOf('  // ===========================================================================\n' + START);
must(si >= 0, "baslangic isareti bulunamadi");
let ei = s.indexOf('  // ===========================================================================\n' + END);
must(ei > si, "bitis isareti bulunamadi");

const NEW_SCREEN = [
  '  // DURUM 1: GARSON HENUZ ALAKART SECMEDIYSE (ALAKART SECIM EKRANI)',
  '  // ===========================================================================',
  '  // Birden fazla alakarta atanmis garson giris sonrasi bu ekrani gorur ve',
  '  // secilen alakart session cookie\'sine kilitlenir. Tek alakart atanmis',
  '  // kullanicilarda loginAction otomatik atar, bu ekran hic gosterilmez.',
  '  if (!session?.activeRestaurantId) {',
  '    const selectable = availableRestaurants.filter((r) => r.active !== false);',
  '',
  '    if (selectable.length === 0) {',
  '      return (',
  '        <div className="flex-1 flex flex-col p-4 sm:p-8 max-w-lg mx-auto w-full justify-center text-center">',
  '          <ChefHat className="w-14 h-14 text-zinc-700 mb-4 mx-auto" />',
  '          <h2 className="text-xl font-black text-white mb-2">Alakart Atanmamis</h2>',
  '          <p className="text-zinc-400 text-sm">',
  '            Hesabiniza atanmis bir alakart bulunmuyor. Lutfen sistem yoneticisinden',
  '            alakart atamasi isteyin.',
  '          </p>',
  '          <p className="text-zinc-500 text-xs mt-4">',
  '            Giris yapan kullanici: {session?.name}',
  '          </p>',
  '        </div>',
  '      );',
  '    }',
  '',
  '    return (',
  '      <div className="flex-1 flex flex-col p-4 sm:p-8 max-w-4xl mx-auto w-full justify-center overflow-y-auto">',
  '        <div className="text-center mb-8">',
  '          <span className="text-xs uppercase tracking-widest text-amber-400 font-bold block mb-1">',
  '            ALAKART SECIMI',
  '          </span>',
  '          <h2 className="text-2xl sm:text-3xl font-black text-white">',
  '            Sayin {session?.name}, Hangi Alakartta Gorevlisiniz?',
  '          </h2>',
  '          <p className="text-zinc-400 text-xs sm:text-sm mt-1">',
  '            Size atanmis {selectable.length} alakart bulundu. Gorevli oldugunuz alakarti secin;',
  '            seciminiz kilitlenecek ve karisikligi onlemek icin ozel renk temasi uygulanacaktir.',
  '          </p>',
  '        </div>',
  '',
  '        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">',
  '          {selectable.map((r) => {',
  '            const theme = getRestaurantTheme(r.code || r.name);',
  '            return (',
  '              <button',
  '                key={r.id}',
  '                onClick={() => handleSelectRestaurant(r.id)}',
  '                className={clsx(',
  '                  "p-5 rounded-3xl border text-left transition-all active:scale-[0.98] group flex flex-col justify-between",',
  '                  theme.bgDark,',
  '                  theme.border,',
  '                  theme.glow,',
  '                  "hover:ring-2 hover:ring-amber-400/50"',
  '                )}',
  '              >',
  '                <div>',
  '                  <div className="flex items-center justify-between mb-3">',
  '                    <span className="text-3xl">{theme.iconEmoji}</span>',
  '                    <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full border", theme.badge)}>',
  '                      {r.code}',
  '                    </span>',
  '                  </div>',
  '                  <h3 className="text-lg font-black text-white group-hover:text-amber-300 transition-colors">',
  '                    {r.name}',
  '                  </h3>',
  '                  <p className="text-zinc-400 text-xs mt-1 leading-relaxed">',
  '                    {r.description || theme.subtitle}',
  '                  </p>',
  '                </div>',
  '',
  '                <div className="pt-4 border-t border-zinc-800/80 mt-4 flex items-center justify-between text-xs font-bold text-amber-400">',
  '                  <span>Giris Yap &amp; Kilitle</span>',
  '                  <span>&#10148;</span>',
  '                </div>',
  '              </button>',
  '            );',
  '          })}',
  '        </div>',
  '      </div>',
  '    );',
  '  }',
  '',
  '  // ===========================================================================',
].join("\n");

s = s.slice(0, si) + NEW_SCREEN + s.slice(ei);
console.log("  [OK] Alakart secim ekrani");

fs.writeFileSync(P, s.split("\n").join("\r\n"), "utf8");
console.log("\nYazildi: " + P + " (" + before.length + " -> " + s.length + " karakter)");
