import fs from "node:fs";
const P = "D:/merit/alacarte/src/app/waiter/page.tsx";
let lines = fs.readFileSync(P, "utf8").split("\r\n");

const map = {
  492: "  // DURUM 1: GARSON HENÜZ ALAKART SEÇMEDİYSE (ALAKART SEÇİM EKRANI)",
  494: "  // Birden fazla alakarta atanmış garson giriş sonrası bu ekranı görür ve",
  495: "  // seçilen alakart session cookie'sine kilitlenir. Tek alakart atanmış",
  496: "  // kullanıcılarda loginAction otomatik atar, bu ekran hiç gösterilmez.",
  504: '          <h2 className="text-xl font-black text-white mb-2">Alakart Atanmamış</h2>',
  506: "            Hesabınıza atanmış bir alakart bulunmuyor. Lütfen sistem yöneticisinden",
  507: "            alakart ataması isteyin.",
  510: "            Giriş yapan kullanıcı: {session?.name}",
  520: "            ALAKART SEÇİMİ",
  523: "            Sayın {session?.name}, Hangi Alakartta Görevlisiniz?",
  526: "            Size atanmış {selectable.length} alakart bulundu. Görevli olduğunuz alakartı seçin;",
  527: "            seçiminiz kilitlenecek ve karışıklığı önlemek için özel renk teması uygulanacaktır.",
  562: '                  <span>Giriş Yap &amp; Kilitle</span>',
};

for (const [idx, text] of Object.entries(map)) {
  const i = Number(idx);
  if (!lines[i] || lines[i].trim() === "") { console.error("HATA bos satir: " + (i + 1)); process.exit(1); }
  lines[i] = text;
}

// handleSelectRestaurant Turkce metinleri
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("// Alakart Secimi Yapildiginda (Kilitleme)")) {
    lines[i] = "  // Alakart Seçimi Yapıldığında (Kilitleme)";
  }
  if (lines[i].includes('alert("Alakart secilemedi: "')) {
    lines[i] = '        alert("Alakart seçilemedi: " + (res.error || "Bilinmeyen bir hata oluştu. Lütfen tekrar deneyin."));';
  }
  if (lines[i].includes('alert("Sistem hatasi: "')) {
    lines[i] = '      alert("Sistem hatası: " + err.message);';
  }
}

fs.writeFileSync(P, lines.join("\r\n"), "utf8");
console.log("Turkce metinler duzeltildi (" + Object.keys(map).length + " satir + 3 alert/comment)");