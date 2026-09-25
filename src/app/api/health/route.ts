import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Veritabanı bağlantı testi
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      app: "alacarte",
      time: new Date().toISOString(),
      database: "connected",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
