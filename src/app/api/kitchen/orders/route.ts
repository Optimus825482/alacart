import { NextRequest, NextResponse } from "next/server";
import { getActiveKitchenOrders, updateOrderStatus, markOrderPrinted } from "@/actions/orders";
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('alacarte_session');
    if (!sessionCookie?.value) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId") || undefined;
    const res = await getActiveKitchenOrders(restaurantId);
    return NextResponse.json(res);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('alacarte_session');
    if (!sessionCookie?.value) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const body = await req.json();
    const { orderId, status } = body;
    if (!orderId || !status) {
      return NextResponse.json({ success: false, error: "Eksik parametre" }, { status: 400 });
    }
    const res = await updateOrderStatus(orderId, status);
    return NextResponse.json(res);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('alacarte_session');
    if (!sessionCookie?.value) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const body = await req.json();
    const { orderId, action } = body;
    if (action === "print" && orderId) {
      const res = await markOrderPrinted(orderId);
      return NextResponse.json(res);
    }
    return NextResponse.json({ success: false, error: "Geçersiz işlem" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
