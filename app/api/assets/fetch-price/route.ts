import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchPrice } from "@/lib/price-fetcher";

const RATE_LIMIT_HOURS = 24;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assetId } = await req.json();
  if (!assetId) {
    return NextResponse.json({ error: "assetId required" }, { status: 400 });
  }

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  if (!asset.priceUrl) {
    return NextResponse.json({ error: "No price URL configured" }, { status: 400 });
  }

  // 24-hour rate limiting
  if (asset.priceUpdatedAt) {
    const hoursAgo =
      (Date.now() - asset.priceUpdatedAt.getTime()) / (1000 * 60 * 60);
    if (hoursAgo < RATE_LIMIT_HOURS) {
      return NextResponse.json({
        price: asset.price ? Number(asset.price) : null,
        currency: asset.priceCurrency,
        cached: true,
      });
    }
  }

  const result = await fetchPrice(asset.priceUrl);
  if (!result) {
    return NextResponse.json({ error: "Failed to fetch price" }, { status: 422 });
  }

  const updated = await prisma.asset.update({
    where: { id: assetId },
    data: {
      price: result.price,
      priceCurrency: result.currency,
      priceUpdatedAt: new Date(),
    },
  });

  return NextResponse.json({
    price: Number(updated.price),
    currency: updated.priceCurrency,
    cached: false,
  });
}
