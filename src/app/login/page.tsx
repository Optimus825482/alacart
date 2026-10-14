"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/actions/pos";

const DEMO_ACCOUNTS = [
  {
    role: "Sistem Yöneticisi",
    username: "sistem.yoneticisi",
    secret: "Admin1234!",
    icon: "👑",
    desc: "Tüm sistem, tanılama, log ve yapılandırma yetkileri",
  },
  {
    role: "Restoran Müdürü",
    username: "mehmet.kaya",
    secret: "Manager1234!",
    icon: "👔",
    desc: "Masa yönetimi, adisyon birleştirme, iptal onayı, raporlar",
  },
  {
    role: "Garson",
    username: "ayse.yilmaz",
    secret: "Waiter1234!",
    icon: "📱",
    desc: "Garson PWA, sipariş alma, masa açma, mutfak yazdırma",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [secret, setSecret] = useState("");

  function performLogin(loginUsername: string, loginSecret: string) {
    setError("");
    startTransition(async () => {
      const result = await loginAction({
        username: loginUsername,
        secret: loginSecret,
        deviceLabel: "Coolify Demo Tarayıcısı",
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace("/");
      router.refresh();
    });
  }

  function submit(formData: FormData) {
    const u = String(formData.get("username") ?? username);
    const s = String(formData.get("secret") ?? secret);
    performLogin(u, s);
  }

  function handleQuickLogin(accUsername: string, accSecret: string) {
    setUsername(accUsername);
    setSecret(accSecret);
    performLogin(accUsername, accSecret);
  }

  return (
    <main className="min-h-dvh grid place-items-center bg-[#101819] p-4 text-[#f0f5f3]">
      <div className="w-full max-w-md rounded-2xl border border-[#344647] bg-[#172324] p-6 sm:p-7 shadow-2xl">
        <div className="mb-5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-bold tracking-[0.25em] text-[#73d8c6]">ALACARTE</p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-950/90 border border-red-500/80 text-red-300 text-[11px] font-black tracking-wider uppercase demo-blinking-badge">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping inline-block" />
              DEMO MODU
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold">Restoran sistemine giriş</h1>
          <p className="mt-1 text-xs sm:text-sm text-[#9aaead]">
            Uygulamayı incelemek için aşağıdaki hazır demo butonlarını kullanabilirsiniz.
          </p>
        </div>

        {/* Hızlı Demo Girişi Butonları */}
        <div className="mb-5 rounded-xl border border-[#344647] bg-[#101819] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#73d8c6] uppercase tracking-wider">
              🚀 Tek Tıkla Demo Girişi
            </span>
            <span className="text-[10px] text-[#9aaead]">Otomatik oturum aç</span>
          </div>
          <div className="flex flex-col gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.username}
                type="button"
                disabled={pending}
                onClick={() => handleQuickLogin(acc.username, acc.secret)}
                className="w-full flex items-center justify-between gap-2.5 rounded-lg border border-[#2b3c3d] bg-[#162324] p-2.5 text-left transition hover:border-[#73d8c6] hover:bg-[#1f3233] disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg shrink-0">{acc.icon}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#f0f5f3] truncate">{acc.role}</div>
                    <div className="text-[10px] text-[#9aaead] truncate">{acc.desc}</div>
                  </div>
                </div>
                <span className="shrink-0 text-[11px] font-bold text-[#73d8c6] bg-[#244440] px-2 py-1 rounded">
                  Giriş →
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative mb-5 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#344647]" />
          </div>
          <span className="relative bg-[#172324] px-2 text-[11px] text-[#718584]">
            veya manuel hesap bilgisi
          </span>
        </div>

        <form action={submit}>
          <label className="mb-3 block text-xs font-medium">Kullanıcı adı
            <input
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              placeholder="örn: sistem.yoneticisi"
              className="mt-1 w-full rounded-lg border border-[#405454] bg-[#101819] px-3 py-2 text-sm"
            />
          </label>
          <label className="mb-4 block text-xs font-medium">Parola veya PIN
            <input
              name="secret"
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="mt-1 w-full rounded-lg border border-[#405454] bg-[#101819] px-3 py-2 text-sm"
            />
          </label>
          {error && <p role="alert" className="mb-4 rounded-lg border border-red-800 bg-red-950/40 p-2.5 text-xs text-red-200">{error}</p>}
          <button disabled={pending} className="w-full rounded-lg bg-[#73d8c6] px-4 py-2.5 text-sm font-bold text-[#10221f] transition hover:bg-[#86e2d2] disabled:opacity-60">
            {pending ? "Giriş yapılıyor…" : "Giriş yap"}
          </button>
        </form>
      </div>

      {/* Ekran köşesinde parıldayan DEMO MODU rozeti */}
      <div className="fixed bottom-4 right-4 z-50 pointer-events-none select-none flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/90 border border-red-500/80 text-red-200 text-xs font-black tracking-widest shadow-2xl backdrop-blur demo-blinking-badge">
        <span className="w-2 h-2 rounded-full bg-red-400 animate-ping inline-block" />
        <span>DEMO MODU</span>
      </div>
    </main>
  );
}
