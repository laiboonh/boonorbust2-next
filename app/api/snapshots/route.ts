import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLatestPositions } from "@/lib/positions";
import { convertAmount } from "@/lib/exchange-rates";
import { parseDecimal } from "@/lib/utils";

/**
 * POST /api/snapshots
 * Records today's portfolio total value as a snapshot.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currency: true },
  });
  const targetCurrency = user?.currency ?? "SGD";

  const positions = await getLatestPositions(session.user.id);
  let totalValue = 0;
  for (const pos of positions) {
    const amount = parseDecimal(pos.amountOnHand);
    const converted = await convertAmount(
      amount,
      pos.amountOnHandCurrency,
      targetCurrency
    );
    totalValue += converted;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const snapshot = await prisma.portfolioSnapshot.upsert({
    where: {
      userId_snapshotDate: {
        userId: session.user.id,
        snapshotDate: today,
      },
    },
    create: {
      userId: session.user.id,
      snapshotDate: today,
      totalValue,
      currency: targetCurrency,
    },
    update: {
      totalValue,
      currency: targetCurrency,
    },
  });

  return NextResponse.json(snapshot);
}
