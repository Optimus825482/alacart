import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getAuthenticatedActor } from "@/lib/auth-guard";

export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthenticatedActor();
    if (!actor) {
      return NextResponse.json({ success: false, error: "Oturum gerekli." }, { status: 401 });
    }
    if (!["SYSTEM_ADMIN", "RESTAURANT_MANAGER"].includes(actor.role)) {
      return NextResponse.json({ success: false, error: "Bu işlem için yetkiniz yok." }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "Dosya bulunamadı." }, { status: 400 });
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'Dosya boyutu 5MB limitini aşıyor.' }, { status: 400 });
    }

    const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const fileExt = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json({ success: false, error: 'Geçersiz dosya formatı.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const signatures: Record<string, boolean> = {
      ".jpg": buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
      ".jpeg": buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
      ".png": buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      ".gif": buffer.subarray(0, 3).toString("ascii") === "GIF",
      ".webp": buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP",
    };
    if (!signatures[fileExt]) {
      return NextResponse.json({ success: false, error: "Dosyanın içeriği seçilen görsel biçimiyle eşleşmiyor." }, { status: 400 });
    }

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
