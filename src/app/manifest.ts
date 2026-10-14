import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/?pwa=alacarte-waiter",
    name: "ALACARTE · Garson Mobil El Terminali & POS",
    short_name: "Alacarte POS",
    description:
      "Garson Mobil Sipariş, Masa Planı ve Restoran Operasyon Terminali",
    start_url: "/?pwa=1&mode=waiter",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#101819",
    theme_color: "#101819",
    lang: "tr",
    dir: "ltr",
    categories: ["food", "business", "productivity"],
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Masa Planı (SCR-03)",
        short_name: "Masalar",
        description: "Tüm salon ve teras masalarını görüntüle",
        url: "/?screen=SCR-03&mode=waiter",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Sipariş Girişi (SCR-04)",
        short_name: "Sipariş",
        description: "Seçili masada hızlı sipariş ve koltuk ekranını aç",
        url: "/?screen=SCR-04&mode=waiter",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Beklet / Zamanlı Gönderim (SCR-06)",
        short_name: "Zamanlı",
        description: "Bekletilen ve ileri saatli yemekleri yönet",
        url: "/?screen=SCR-06&mode=waiter",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "İptal Talebi (SCR-09)",
        short_name: "İptal Talebi",
        description: "Mutfağa gönderilmiş ürün için iptal talebi oluştur",
        url: "/?screen=SCR-09&mode=waiter",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
