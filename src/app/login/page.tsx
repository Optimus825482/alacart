"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/actions/auth";
import {
  UtensilsCrossed,
  Lock,
  User,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  X,
  Info,
  ChefHat,
  Store,
  BarChart3,
  BellRing,
  FileSpreadsheet,
  ClipboardList,
  MonitorSmartphone,
} from "lucide-react";

const DEMO_KAYIT = "alacarte_demo_bilgi_kapatildi";

const DEMO_MODULLERI = [
  {
    ikon: ClipboardList,
    renk: "text-amber-400",
    baslik: "Garson Modulu",
    giris: "ahmet / 1234",
    satirlar: [
      "Alakart secimi yaparak siparis girisi",
      "Masa secimi, urun ve servis notu secimi",
      "Siparislerim sekmesinde gunluk siparisler",
      "Iptal onayi ile siparis iptali",
    ],
  },
  {
    ikon: ChefHat,
    renk: "text-emerald-400",
    baslik: "Mutfak Modulu",
    giris: "mutfak.roof / 1234",
    satirlar: [
      "Anlik gelen siparis bildirimleri",
      "Hazirlaniyor / Tamamlandi durum yonetimi",
      "Siparis detayinda misafir notlari",
      "Her alakartin kendi mutfak hesabi vardir",
    ],
  },
  {
    ikon: BarChart3,
    renk: "text-purple-400",
    baslik: "Kordinator Sef Modulu",
    giris: "sef / sef123",
    satirlar: [
      "Tum alakartlarin canli isleyisini izleme",
      "Belirli gun veya tarih araligi raporlari",
      "PDF ve Excel cikti alabilme",
      "Bu raporlar yonetim ekraninda yoktur",
    ],
  },
  {
    ikon: Store,
    renk: "text-cyan-400",
    baslik: "Sistem Yoneticisi Modulu",
    giris: "admin / admin123",
    satirlar: [
      "Kullanici ve PIN kodu tanimlari",
      "Alakart restoran ve masa tanimlari",
      "Menu, menu grubu ve menu ogesi tanimlari",
      "Yeni alakarta otomatik mutfak hesabi",
    ],
  },
];

const DEMO_MUTFAK_HESAPLARI = [
  { kod: "roof", ad: "The Roof Garden", kullanici: "mutfak.roof" },
  { kod: "steak", ad: "The Steak House", kullanici: "mutfak.steak" },
  { kod: "bluesea", ad: "Blue Sea", kullanici: "mutfak.bluesea" },
  { kod: "mandarin", ad: "Mandarin", kullanici: "mutfak.mandarin" },
  { kod: "bella", ad: "Bella Merit", kullanici: "mutfak.bella" },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [demoAcik, setDemoAcik] = useState(false);

  // DEMO bilgi penceresi yalnizca ilk acilista gosterilir.
  useEffect(() => {
    try {
      if (!window.localStorage.getItem(DEMO_KAYIT)) {
        setDemoAcik(true);
      }
    } catch {
      setDemoAcik(true);
    }
  }, []);

  const demoKapat = () => {
    setDemoAcik(false);
    try {
      window.localStorage.setItem(DEMO_KAYIT, "1");
    } catch {}
  };

  const demoGoster = () => {
    try {
      window.localStorage.removeItem(DEMO_KAYIT);
    } catch {}
    setDemoAcik(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);

    const res = await loginAction(formData);

    if (res.success && res.redirectUrl) {
      router.push(res.redirectUrl);
      router.refresh();
    } else {
      setErrorMessage(res.error || "Giriş başarısız oldu.");
      setLoading(false);
    }
  };

  const fillQuick = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 bg-[#070a12] relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-[#0f1422] border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-amber-500/20">
            <UtensilsCrossed className="w-7 h-7 text-zinc-950 font-bold" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-widest text-white">
            ALACARTE
          </h1>
          <p className="text-zinc-400 text-xs mt-1.5">
            Sisteme erişmek için lütfen giriş yapın
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-5 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs text-center font-medium animate-in fade-in">
            {errorMessage}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-zinc-400 block mb-1.5 font-bold uppercase tracking-wider text-[11px]">
              Kullanıcı Adı
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                autoComplete="username"
                placeholder="Örn: ahmet, sef, admin, mutfak.roof"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-zinc-900/90 border border-zinc-700/80 rounded-2xl pl-10 pr-3.5 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-zinc-400 block mb-1.5 font-bold uppercase tracking-wider text-[11px]">
              Şifre
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-900/90 border border-zinc-700/80 rounded-2xl pl-10 pr-3.5 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-zinc-950 font-black text-sm shadow-xl shadow-amber-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? (
              <span>Giriş Yapılıyor...</span>
            ) : (
              <>
                <span>SİSTEME GİRİŞ YAP</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* DEMO MODU - HIZLI GIRIS BUTONLARI */}
        <div className="mt-8 pt-6 border-t border-zinc-800/80">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Demo Modu • Hızlı Giriş
              </span>
            </div>
            <button
              type="button"
              onClick={demoGoster}
              className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 hover:text-amber-400 transition-colors"
              title="Demo bilgi penceresini tekrar göster"
            >
              <Info className="w-3 h-3" />
              Demo Bilgisi
            </button>
          </div>

          <p className="text-[10px] leading-relaxed text-zinc-500 mb-3">
            Görmek istediğiniz ekranı seçmek için aşağıdaki giriş butonlarını
            kullanabilirsiniz. Butona basınca kullanıcı adı ve şifre otomatik
            dolar, yalnızca “Sisteme Giriş Yap” demeniz yeterlidir.
          </p>

          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <button
              type="button"
              onClick={() => fillQuick("ahmet", "1234")}
              className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-amber-500/30 text-left transition-all"
            >
              <span className="text-amber-400 font-bold block">Garson</span>
              <span className="text-zinc-500">ahmet / 1234</span>
            </button>

            <button
              type="button"
              onClick={() => fillQuick("sef", "sef123")}
              className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-purple-500/30 text-left transition-all"
            >
              <span className="text-purple-400 font-bold block">Şef Modülü</span>
              <span className="text-zinc-500">sef / sef123</span>
            </button>

            <button
              type="button"
              onClick={() => fillQuick("admin", "admin123")}
              className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-cyan-500/30 text-left transition-all"
            >
              <span className="text-cyan-400 font-bold block">Yönetici</span>
              <span className="text-zinc-500">admin / admin123</span>
            </button>
          </div>

          {/* MUTFAK GIRIS BUTONLARI - her alakartin kendi mutfak hesabi */}
          <div className="mt-3 p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-2">
              <ChefHat className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Mutfak Giriş Butonları
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 mb-2 leading-relaxed">
              Mutfak genel kullanıma açıktır. Her alakartın kendi kullanıcı adı ve
              şifresi vardır; şifre tümünde <span className="text-zinc-300 font-semibold">1234</span>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {DEMO_MUTFAK_HESAPLARI.map((h) => (
                <button
                  key={h.kod}
                  type="button"
                  onClick={() => fillQuick(h.kullanici, "1234")}
                  className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-emerald-500/25 text-left transition-all"
                >
                  <span className="text-emerald-400 font-bold truncate">{h.ad}</span>
                  <span className="text-zinc-500 font-mono text-[9px] shrink-0">
                    {h.kullanici}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================
          DEMO BILGI PENCERESI (ilk acilista gosterilir)
      ========================================== */}
      {demoAcik && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={demoKapat}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0f1422] border border-amber-500/40 rounded-3xl shadow-2xl shadow-amber-500/10"
          >
            {/* Baslik */}
            <div className="flex items-start justify-between gap-4 p-5 sm:p-6 pb-4 border-b border-zinc-800">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <Sparkles className="w-5 h-5 text-zinc-950" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-wide">
                    Bu Bir DEMO Sürümüdür
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    ALACARTE restoran işletme ve sipariş yönetim sisteminin
                    tanıtım sürümüdür.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={demoKapat}
                className="w-8 h-8 shrink-0 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                title="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              {/* Demo uyarisi */}
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-100/90 leading-relaxed">
                  <span className="font-bold text-amber-300">Demo modundasınız.</span>{" "}
                  Gerçek bir tesis verisi kullanılmaz; alakartlar, menüler,
                  masalar ve raporlar örnek verilerdir. Görmek istediğiniz ekranı
                  veya özelliği seçmek için{" "}
                  <span className="font-bold text-amber-300">
                    aşağıdaki giriş butonlarını
                  </span>{" "}
                  kullanabilirsiniz. Butonlar kullanıcı adı ve şifreyi sizin için
                  otomatik doldurur.
                </p>
              </div>

              {/* Cihaz bilgisi */}
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                <MonitorSmartphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  Uygulama masaüstü, tablet ve telefondan kullanılabilir; tesis
                  talebine göre internet üzerinden veya yerel ağ (lokal) içinde
                  çalışabilir.
                </span>
              </div>

              {/* Modul kartlari */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2.5">
                  Modüller ve Giriş Bilgileri
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {DEMO_MODULLERI.map((m) => {
                    const Ikon = m.ikon;
                    return (
                      <div
                        key={m.baslik}
                        className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span
                            className={`flex items-center gap-1.5 text-xs font-bold ${m.renk}`}
                          >
                            <Ikon className="w-3.5 h-3.5" />
                            {m.baslik}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0">
                            {m.giris}
                          </span>
                        </div>
                        <ul className="space-y-1">
                          {m.satirlar.map((satir) => (
                            <li
                              key={satir}
                              className="flex items-start gap-1.5 text-[10.5px] text-zinc-400 leading-snug"
                            >
                              <span className="text-zinc-600 mt-0.5">•</span>
                              {satir}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Vurgu */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="flex items-start gap-2 p-3 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                  <BellRing className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[10.5px] text-zinc-400 leading-snug">
                    <span className="text-amber-300 font-semibold">Anlık bildirim</span>{" "}
                    ile misafir talebi masadan mutfağa anında iletilir.
                  </p>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-2xl bg-purple-500/5 border border-purple-500/20">
                  <FileSpreadsheet className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <p className="text-[10.5px] text-zinc-400 leading-snug">
                    Gün veya tarih aralığı raporları{" "}
                    <span className="text-purple-300 font-semibold">PDF / Excel</span>{" "}
                    olarak alınır.
                  </p>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                  <ChefHat className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[10.5px] text-zinc-400 leading-snug">
                    Mutfak ve garson arasındaki{" "}
                    <span className="text-emerald-300 font-semibold">
                      iletişim kopukluğu
                    </span>{" "}
                    anlık bildirimlerle önlenir.
                  </p>
                </div>
              </div>
            </div>

            {/* Alt bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-5 sm:p-6 pt-4 border-t border-zinc-800 bg-zinc-900/40 rounded-b-3xl">
              <p className="text-[10px] text-zinc-500 text-center sm:text-left leading-relaxed">
                Bu pencere yalnızca ilk açılışta gösterilir. Daha sonra
                giriş ekranındaki “Demo Bilgisi” bağlantısından tekrar açabilirsiniz.
              </p>
              <button
                type="button"
                onClick={demoKapat}
                className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-zinc-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all"
              >
                Anladım, Başlayalım
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
