import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLatestPositions } from "@/lib/positions";
import { convertAmount } from "@/lib/exchange-rates";

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
    const converted = await convertAmount(
      pos.amountOnHand,
      pos.amountOnHandCurrency,
      targetCurrency
    );
    totalValue += converted;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.$executeRaw`
    INSERT INTO portfolio_snapshots (user_id, snapshot_date, total_value, updated_at)
    VALUES (
      ${session.user.id},
      ${today},
      ROW(${totalValue}::numeric, ${targetCurrency}::bpchar)::money_with_currency,
      NOW()
    )
    ON CONFLICT (user_id, snapshot_date) DO UPDATE SET
      total_value = ROW(${totalValue}::numeric, ${targetCurrency}::bpchar)::money_with_currency,
      updated_at  = NOW()
  `;

  return NextResponse.json({ ok: true });
}
