import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SUPPORTED_CURRENCIES = ["SGD", "USD", "EUR", "HKD", "AUD", "GBP", "JPY", "CAD", "CHF"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { currency } = await req.json();
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    return NextResponse.json({ error: "Unsupported currency" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { currency },
  });

  return NextResponse.json({ currency });
}
