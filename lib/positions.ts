import { prisma } from "@/lib/prisma";
import { parseDecimal } from "@/lib/utils";

/**
 * Recalculates and upserts portfolio positions for all transactions of an asset.
 * Uses running average cost basis algorithm.
 */
export async function recalculatePositionsForAsset(
  assetId: number,
  userId: string
): Promise<void> {
  const transactions = await prisma.portfolioTransaction.findMany({
    where: { assetId, userId },
    orderBy: { transactionDate: "asc" },
  });

  let avgPrice = 0;
  let qtyOnHand = 0;
  const currency =
    transactions[0]?.amountCurrency || transactions[0]?.priceCurrency || "SGD";

  for (const tx of transactions) {
    const qty = parseDecimal(tx.quantity);
    const price = parseDecimal(tx.price);
    const commission = parseDecimal(tx.commission);

    if (tx.action === "buy") {
      const totalCost = price * qty + commission;
      const newQty = qtyOnHand + qty;
      avgPrice =
        newQty > 0
          ? (avgPrice * qtyOnHand + totalCost) / newQty
          : 0;
      qtyOnHand = newQty;
    } else {
      // sell
      const realizedProfit = (price - avgPrice) * qty - commission;
      qtyOnHand = Math.max(0, qtyOnHand - qty);
      // avg price unchanged on sell

      // Upsert realized profit for this sell transaction
      await prisma.realizedProfit.upsert({
        where: { portfolioTransactionId: tx.id },
        create: {
          userId,
          assetId,
          portfolioTransactionId: tx.id,
          amount: realizedProfit,
          amountCurrency: tx.amountCurrency,
        },
        update: {
          amount: realizedProfit,
          amountCurrency: tx.amountCurrency,
        },
      });
    }

    const amountOnHand = avgPrice * qtyOnHand;

    await prisma.portfolioPosition.upsert({
      where: { portfolioTransactionId: tx.id },
      create: {
        userId,
        assetId,
        portfolioTransactionId: tx.id,
        averagePrice: avgPrice,
        averagePriceCurrency: currency,
        quantityOnHand: qtyOnHand,
        amountOnHand,
        amountOnHandCurrency: currency,
      },
      update: {
        averagePrice: avgPrice,
        averagePriceCurrency: currency,
        quantityOnHand: qtyOnHand,
        amountOnHand,
        amountOnHandCurrency: currency,
      },
    });
  }
}

/**
 * Returns the latest portfolio position for each asset held by the user.
 */
export async function getLatestPositions(userId: string) {
  // Get all positions ordered by transaction date, then pick latest per asset
  const positions = await prisma.portfolioPosition.findMany({
    where: { userId },
    include: {
      asset: {
        include: {
          assetTags: {
            include: { tag: true },
          },
        },
      },
      portfolioTransaction: true,
    },
    orderBy: {
      portfolioTransaction: { transactionDate: "desc" },
    },
  });

  // Keep only the latest position per asset (first seen since ordered desc)
  const seen = new Set<number>();
  const latest: typeof positions = [];
  for (const pos of positions) {
    if (!seen.has(pos.assetId) && parseDecimal(pos.quantityOnHand) > 0) {
      seen.add(pos.assetId);
      latest.push(pos);
    }
  }

  return latest;
}
