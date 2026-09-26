import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "Dosya bulunamadı." }, { status: 400 });
    }

    // Basit MIME kontrolü
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ success: false, error: "Lütfen yalnızca geçerli bir resim dosyası seçin (PNG, JPG, WEBP)." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const ext = path.extname(file.name) || ".jpg";
    const cleanExt = ext.replace(/[^a-zA-Z0-9.]/g, "").toLowerCase() || ".jpg";
    const fileName = `menu_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${cleanExt}`;
    const filePath = path.join(uploadDir, fileName);

    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/${fileName}`;

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ success: false, error: error.message || "Görsel yüklenirken bir hata oluştu." }, { status: 500 });
  }
}
