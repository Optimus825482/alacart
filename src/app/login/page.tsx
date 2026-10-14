"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/actions/pos";

export default function LoginPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function submit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await loginAction({
        username: String(formData.get("username") ?? ""),
        secret: String(formData.get("secret") ?? ""),
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

  return (
    <main className="min-h-dvh grid place-items-center bg-[#101819] p-5 text-[#f0f5f3]">
      <form action={submit} className="w-full max-w-sm rounded-2xl border border-[#344647] bg-[#172324] p-7 shadow-2xl">
        <div className="mb-6">
          <p className="text-xs font-bold tracking-[0.25em] text-[#73d8c6]">ALACARTE</p>
          <h1 className="mt-2 text-2xl font-bold">Restoran sistemine giriş</h1>
          <p className="mt-2 text-sm text-[#9aaead]">Kişisel kullanıcı hesabınızla devam edin.</p>
        </div>
        <label className="mb-4 block text-sm">Kullanıcı adı
          <input name="username" autoComplete="username" required className="mt-1 w-full rounded-lg border border-[#405454] bg-[#101819] px-3 py-2.5" />
        </label>
        <label className="mb-5 block text-sm">Parola veya PIN
          <input name="secret" type="password" autoComplete="current-password" required className="mt-1 w-full rounded-lg border border-[#405454] bg-[#101819] px-3 py-2.5" />
        </label>
        {error && <p role="alert" className="mb-4 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
        <button disabled={pending} className="w-full rounded-lg bg-[#73d8c6] px-4 py-3 font-bold text-[#10221f] disabled:opacity-60">
          {pending ? "Giriş yapılıyor…" : "Giriş yap"}
        </button>
      </form>
    </main>
  );
}
