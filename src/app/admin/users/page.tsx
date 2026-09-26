"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Users, Shield, Smartphone, ChefHat, X, Check } from "lucide-react";
import { getUsers, createUser, updateUser, deleteUser, getRestaurants } from "@/actions/definitions";
import clsx from "clsx";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<"ADMIN" | "CHEF" | "WAITER" | "KITCHEN">("WAITER");
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [uRes, rRes] = await Promise.all([getUsers(), getRestaurants()]);
    if (uRes.success && uRes.data) setUsers(uRes.data);
    if (rRes.success && rRes.data) setRestaurants(rRes.data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setName("");
    setUsername("");
    setPassword("");
    setPin("");
    setRole("WAITER");
    setSelectedRestaurantIds([]);
    setIsModalOpen(true);
  };

  const openEditModal = (u: any) => {
    setEditingUser(u);
    setName(u.name);
    setUsername(u.username);
    setPassword("");
    setPin(u.pin);
    setRole(u.role);
    setSelectedRestaurantIds(u.assignedTo?.map((a: any) => a.restaurantId) || []);
    setIsModalOpen(true);
  };

  const toggleRestaurant = (rid: string) => {
    setSelectedRestaurantIds((prev) => {
      if (prev.includes(rid)) return prev.filter((id) => id !== rid);
      // Mutfak rolu: her alakartin kendi mutfak kullanici adi + sifresi vardir,
      // bu yuzden yalnizca TEK bir alakart secilebilir.
      if (role === "KITCHEN") return [rid];
      return [...prev, rid];
    });
  };

  const handleRoleChange = (nextRole: "ADMIN" | "CHEF" | "WAITER" | "KITCHEN") => {
    setRole(nextRole);
    // Mutfak rolune gecildiginde secim en fazla bir alakarta dusurulur.
    setSelectedRestaurantIds((prev) => (prev.length > 1 ? [prev[0]] : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !pin.trim()) return;

    if (role === "KITCHEN" && selectedRestaurantIds.length !== 1) {
      alert("Mutfak rolu icin tam olarak 1 alakart restoran secilmelidir.");
      return;
    }

    setSubmitting(true);
    if (editingUser) {
      await updateUser(editingUser.id, {
        name,
        username,
        password: password.trim() || undefined,
        pin,
        role,
        restaurantIds: selectedRestaurantIds,
      });
    } else {
      await createUser({
        name,
        username,
        password: password.trim() || undefined,
        pin,
        role,
        restaurantIds: selectedRestaurantIds,
      });
    }
    setSubmitting(false);
    setIsModalOpen(false);
    loadData();
  };

  const handleDelete = async (id: string, uName: string) => {
    if (confirm(`"${uName}" kullanıcısını silmek istediğinize emin misiniz?`)) {
      const res = await deleteUser(id);
      if (!res.success) {
        alert('Silme hatası: ' + (res.error || 'Bilinmeyen hata'));
      }
      loadData();
    }
  };

  const getRoleBadge = (r: string) => {
    switch (r) {
      case "ADMIN":
        return { label: "Yönetici", bg: "bg-purple-500/20 text-purple-300 border-purple-500/30", icon: Shield };
      case "CHEF":
        return { label: "Koordinatör Şef", bg: "bg-amber-500/20 text-amber-300 border-amber-500/30", icon: ChefHat };
      case "KITCHEN":
        return { label: "Mutfak", bg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", icon: ChefHat };
      default:
        return { label: "Garson", bg: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: Smartphone };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs uppercase tracking-wider text-amber-400 font-bold">
            TANIMLAR
          </span>
          <h2 className="text-2xl font-black text-white">Kullanıcı & Garson Tanımları</h2>
          <span className="text-xs text-zinc-400">
            Garsonlar, Mutfak, Yöneticiler ve Dokunmatik PIN Kodları
          </span>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm shadow-md shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Kullanıcı Ekle</span>
        </button>
      </div>

      {/* Users List */}
      {loading ? (
        <div className="p-12 text-center text-zinc-500">Yükleniyor...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {users.map((u) => {
            const roleInfo = getRoleBadge(u.role);
            const RoleIcon = roleInfo.icon;

            return (
              <div
                key={u.id}
                className={clsx(
                  "p-5 rounded-3xl bg-[#0f1422] border flex flex-col justify-between",
                  u.active === false ? "border-zinc-800/60 opacity-55" : "border-zinc-800"
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-amber-400">
                        <RoleIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white">{u.name}</h4>
                        <span className="text-xs text-zinc-400">@{u.username}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(u)}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                        title="Düzenle"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(u.id, u.name)}
                        className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400"
                        title="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 my-3">
                    <span
                      className={clsx(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1",
                        roleInfo.bg
                      )}
                    >
                      <RoleIcon className="w-3 h-3" />
                      <span>{roleInfo.label}</span>
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-amber-300">
                      PIN: {u.pin}
                    </span>
                  </div>

                  {/* Yetkili Alakartlar */}
                  {u.assignedTo && u.assignedTo.length > 0 && (
                    <div className="mt-2">
                      <span className="text-[10px] text-zinc-500 block mb-1">
                        {u.role === "KITCHEN" ? "Bağlı Olduğu Alakart:" : "Yetkili Alakart Restoranlar:"}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {u.assignedTo.map((a: any) => (
                          <span
                            key={a.restaurantId}
                            className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800"
                          >
                            {a.restaurant?.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-zinc-800/80 mt-3 text-right">
                  <span className={clsx("text-[10px] font-semibold", u.active === false ? "text-zinc-500" : "text-emerald-400")}>
                    {u.active === false ? "\u25CB Pasif \u2014 Giri\u015F Yapamaz" : "\u25CF Sistemde Aktif"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1422] border border-zinc-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <h3 className="text-base font-bold text-white">
                {editingUser ? "Kullanıcıyı Düzenle" : "Yeni Kullanıcı Ekle"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">
                  {role === "KITCHEN" ? "Mutfak Adı *" : "Ad Soyad *"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={role === "KITCHEN" ? "Örn: The Roof Garden Mutfak" : "Örn: Ahmet Yılmaz"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1 font-semibold">
                    Kullanıcı Adı *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={role === "KITCHEN" ? "Örn: mutfak.roof" : "Örn: ahmetyilmaz"}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white lowercase focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 block mb-1 font-semibold">
                    Şifre (Web Girişi)
                  </label>
                  <input
                    type="password"
                    placeholder="Örn: 1234 (opsiyonel)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1 font-semibold">
                    Dokunmatik PIN *
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    required
                    placeholder="Örn: 1234"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white font-mono text-center tracking-widest focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 block mb-1 font-semibold">
                    Rol *
                  </label>
                  <select
                    value={role}
                    onChange={(e: any) => handleRoleChange(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="WAITER">Garson</option>
                    <option value="CHEF">Koordinatör Şef</option>
                    <option value="KITCHEN">Mutfak</option>
                    <option value="ADMIN">Sistem Yöneticisi</option>
                  </select>
                </div>
              </div>

              {/* Alakart Yetkilendirmesi */}
              <div>
                <label className="text-zinc-400 block mb-1.5 font-semibold">
                  {role === "KITCHEN"
                    ? "Bağlı Olduğu Alakart Restoran *"
                    : "Yetkili Olduğu Alakart Restoranlar"}
                </label>
                {role === "KITCHEN" && (
                  <p className="text-[10px] leading-relaxed text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-2.5 py-2 mb-2">
                    Her alakartın mutfağı genel kullanıma açıktır ve kendi kullanıcı adı +
                    şifresiyle çalışır. Bu nedenle mutfak hesabı yalnızca bir alakarta
                    bağlanır. Giriş sonrası alakart seçim ekranı gösterilmez.
                  </p>
                )}
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {restaurants.map((r) => {
                    const isChecked = selectedRestaurantIds.includes(r.id);
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => toggleRestaurant(r.id)}
                        className={clsx(
                          "w-full p-2 rounded-xl border flex items-center justify-between transition-all text-left",
                          isChecked
                            ? "bg-amber-500/15 border-amber-500 text-white"
                            : "bg-zinc-900 border-zinc-800 text-zinc-400"
                        )}
                      >
                        <span>{r.name}</span>
                        {isChecked && <Check className="w-4 h-4 text-amber-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold"
                >
                  {submitting ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
