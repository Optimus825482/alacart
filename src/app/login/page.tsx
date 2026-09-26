"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/actions/auth";
import { UtensilsCrossed, Lock, User, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

        {/* Demo Fast Login Selector */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 pt-6 border-t border-zinc-800/80">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Hızlı Rol Seçimi (Test Hesapları)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <button
                type="button"
                onClick={() => fillQuick("ahmet", "1234")}
                className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-amber-500/30 text-left transition-all group"
              >
                <span className="text-amber-400 font-bold block">📱 Garson (Ahmet)</span>
                <span className="text-zinc-500">ahmet / 1234</span>
              </button>

              <button
                type="button"
                onClick={() => fillQuick("mutfak.roof", "1234")}
                className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-emerald-500/30 text-left transition-all group"
              >
                <span className="text-emerald-400 font-bold block">🍳 Mutfak (Roof)</span>
                <span className="text-zinc-500">mutfak.roof / 1234</span>
              </button>

              <button
                type="button"
                onClick={() => fillQuick("sef", "sef123")}
                className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-purple-500/30 text-left transition-all group"
              >
                <span className="text-purple-400 font-bold block">👨‍🍳 Şef Modülü</span>
                <span className="text-zinc-500">sef / sef123</span>
              </button>

              <button
                type="button"
                onClick={() => fillQuick("admin", "admin123")}
                className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-cyan-500/30 text-left transition-all group"
              >
                <span className="text-cyan-400 font-bold block">⚙️ Yönetici (Admin)</span>
                <span className="text-zinc-500">admin / admin123</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
